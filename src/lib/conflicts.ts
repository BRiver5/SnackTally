// «Хочу X в такое-то окно», а в осторожный бюджет не влезает. Говорим, на
// сколько не влезает и почему (среднее + запас на неуверенность порции), и
// предлагаем варианты — каждый проверен повторным решением плана, с итоговой
// ценностью дня, а не обещанием на глаз.

import { PIECES, solvePlan, type DayPlan, type Pin, type PlanInput } from "./planner.ts";

export type Alternative = { kind: "fewer" | "flex" | "swap" | "check"; label: string; detail: string; plan: DayPlan; pin: Pin; flex: number; sdScale: number };
export type PinConflict = { pin: Pin; need: number; cap: number; shortfall: number; margin: number; alternatives: Alternative[] };

export type ConflictCtx = { bank: number; name: (id: string) => string; checks: (id: string) => number };

export function resolvePin(inp: PlanInput, pin: Pin, ctx: ConflictCtx): PinConflict | null {
  const withPin = solvePlan({ ...inp, pins: [pin] });
  if (withPin.feasible) return null;
  const sn = inp.snacks.find((s) => s.id === pin.snack);
  if (!sn) return null;
  const need = (sn.mean + inp.z * sn.sd) * pin.pieces;
  const margin = inp.z * sn.sd * pin.pieces;
  const shortfall = Math.max(0, need - Math.max(0, inp.cap));
  const alts: Alternative[] = [];
  const name = ctx.name(pin.snack);

  for (const k of PIECES) {
    if (k >= pin.pieces) continue;
    const p = { ...pin, pieces: k };
    const plan = solvePlan({ ...inp, pins: [p] });
    if (plan.feasible) alts.push({ kind: "fewer", label: `${k === 0.5 ? "Half" : k} ${k === 1 ? "piece" : k === 0.5 ? "a piece" : "pieces"} of ${name}`, detail: `Fits now and leaves room for the rest of the day.`, plan, pin: p, flex: 0, sdScale: 1 });
  }
  if (ctx.bank > 0) {
    const use = Math.ceil(shortfall / 5) * 5 + 5;
    if (use <= ctx.bank) {
      const plan = solvePlan({ ...inp, cap: inp.cap + use, pins: [pin] });
      if (plan.feasible) alts.push({ kind: "flex", label: `Use ${use} kcal of this week's flex`, detail: `You came in under budget earlier this week — ${Math.round(ctx.bank)} kcal banked.`, plan, pin, flex: use, sdScale: 1 });
    }
  }
  const siblings = inp.snacks.filter((s) => s.id !== pin.snack && s.cat === sn.cat && (s.mean + inp.z * s.sd) < sn.mean + inp.z * sn.sd);
  for (const s of siblings) {
    const p = { ...pin, snack: s.id };
    const plan = solvePlan({ ...inp, pins: [p] });
    if (plan.feasible) alts.push({ kind: "swap", label: `${ctx.name(s.id)} instead`, detail: `Same craving, ${Math.round((sn.mean - s.mean) * pin.pieces)} kcal lighter.`, plan, pin: p, flex: 0, sdScale: 1 });
  }
  if (ctx.checks(pin.snack) < 3 && margin > 0) {
    // Проверка порции обычно сжимает разброс примерно до 60% — пересчитываем план так, как будто это уже случилось.
    const scaled = { ...inp, snacks: inp.snacks.map((s) => (s.id === pin.snack ? { ...s, sd: s.sd * 0.6 } : s)), pins: [pin] };
    const plan = solvePlan(scaled);
    if (plan.feasible) alts.push({ kind: "check", label: `Check the ${name} portion first`, detail: `${Math.round(margin)} kcal of the need is safety margin for an unchecked portion — a check usually frees ~40% of it.`, plan, pin, flex: 0, sdScale: 0.6 });
  }
  alts.sort((a, b) => b.plan.value - a.plan.value);
  return { pin, need, cap: inp.cap, shortfall, margin, alternatives: alts.slice(0, 4) };
}

export type Side = { pIn: number; mean: number; planValue: number; planItems: number };
export type Comparison = { before: Side; after: Side; dropped: string[]; added: string[] };

export function comparePlans(before: Side & { keys: string[] }, after: Side & { keys: string[] }): Comparison {
  const a = new Set(before.keys);
  const b = new Set(after.keys);
  return {
    before: { pIn: before.pIn, mean: before.mean, planValue: before.planValue, planItems: before.planItems },
    after: { pIn: after.pIn, mean: after.mean, planValue: after.planValue, planItems: after.planItems },
    dropped: before.keys.filter((k) => !b.has(k)),
    added: after.keys.filter((k) => !a.has(k)),
  };
}
