import { test } from "node:test";
import assert from "node:assert/strict";
import { addCheck, addRating, estimate, freshPace, freshPortion, observeDay, rate, taste } from "./models.ts";
import { eventKcal, forecast, phi } from "./forecast.ts";
import { option, PIECES, planSlots, solvePlan, type PlanInput } from "./planner.ts";
import { resolvePin } from "./conflicts.ts";

test("portion model moves from the label toward checks and narrows", () => {
  const p0 = estimate(freshPortion(), 160);
  assert.equal(p0.mean, 160);
  let p = freshPortion();
  for (const x of [210, 205, 215]) p = addCheck(p, x);
  const e = estimate(p, 160);
  assert.ok(e.mean > 180 && e.mean < 215);
  assert.ok(e.drift > 0.12);
  assert.ok(e.sd < p0.sd);
});

test("taste shrinks a single rating toward its category", () => {
  const cat = addRating(addRating(undefined, 2), 2);
  const one = taste(addRating(undefined, 5), cat);
  assert.ok(one.value < 5 && one.value > one.category);
});

test("pace learns the evening habit with forgetting", () => {
  let p = freshPace();
  for (let d = 0; d < 10; d++) p = observeDay(p, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0]);
  assert.ok(rate(p, 10) > 1.5);
  assert.ok(rate(p, 4) < 0.1);
});

test("forecast: more budget left means a higher chance; phi is sane", () => {
  assert.ok(Math.abs(phi(0) - 0.5) < 1e-6 && phi(1.96) > 0.97);
  const rates = Array(12).fill(0.3);
  const ev = eventKcal([150, 120, 200]);
  const a = forecast(600, [{ mean: 300, sd: 40, minute: 500 }], rates, ev, 600);
  const b = forecast(600, [{ mean: 300, sd: 40, minute: 500 }], rates, ev, 900);
  assert.ok(b.pIn > a.pIn);
  assert.ok(a.slots[0].frac === 1 && a.mean > 300);
});

const snacks = [
  { id: "choc", cat: "Sweet", mean: 55, sd: 8, taste: 4.6 },
  { id: "nuts", cat: "Nuts", mean: 170, sd: 45, taste: 4.0 },
  { id: "apple", cat: "Fruit", mean: 95, sd: 10, taste: 3.4 },
];
const base = (cap: number, minute = 14 * 60): PlanInput => ({ minute, cap, z: 0.842, snacks, rates: [0, 0, 0, 0, 0, 0, 0.2, 0.5, 0.8, 0.4, 1.0, 0.2], pins: [] });

// Эталон — полный перебор вариантов по окнам с теми же правилами.
function brute(inp: PlanInput): number {
  const slots = planSlots(inp.minute);
  let best = -1;
  const rec = (i: number, used: number, last: string | null, val: number) => {
    if (i === slots.length) {
      best = Math.max(best, val);
      return;
    }
    rec(i + 1, used, null, val);
    for (const s of inp.snacks)
      for (const k of PIECES) {
        if (s.id === last) continue;
        const o = option(s, slots[i], k, inp.z, inp.rates);
        const need = Math.ceil(o.cautious / 5 - 1e-9) * 5;
        if (used + need > Math.floor(inp.cap / 5) * 5) continue;
        rec(i + 1, used + need, s.id, val + o.value);
      }
  };
  rec(0, 0, null, 0);
  return best;
}

test("DP plan equals brute force and never repeats a snack back to back", () => {
  for (const cap of [0, 60, 150, 260, 410]) {
    const p = solvePlan(base(cap, 15 * 60));
    assert.ok(Math.abs(p.value - brute(base(cap, 15 * 60))) < 1e-9, `cap ${cap}`);
    assert.ok(p.used <= cap + 1e-9);
    for (let i = 1; i < p.items.length; i++) if (p.items[i].slot === p.items[i - 1].slot + 1) assert.notEqual(p.items[i].snack, p.items[i - 1].snack);
  }
});

test("pin that doesn't fit yields verified alternatives", () => {
  const inp = base(250, 15 * 60);
  const c = resolvePin(inp, { snack: "nuts", slot: 10, pieces: 2 }, { bank: 300, name: (id) => id, checks: () => 0 });
  assert.ok(c && c.shortfall > 0);
  assert.ok(c!.alternatives.length >= 2);
  for (const a of c!.alternatives) assert.ok(a.plan.feasible && a.plan.items.some((o) => o.slot === 10));
  assert.ok(c!.alternatives.some((a) => a.kind === "flex"));
  assert.equal(resolvePin(inp, { snack: "choc", slot: 10, pieces: 1 }, { bank: 0, name: (id) => id, checks: () => 0 }), null);
});
