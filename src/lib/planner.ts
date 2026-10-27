// План перекусов на остаток дня. В каждое оставшееся окно (до 10pm) — один
// перекус или ничего; вариант = перекус × число штук. Ценность — «стоило ли
// того» из модели вкуса с убывающей отдачей за каждую следующую штуку и
// поправкой на окно (в окна, где обычно тянет перекусить, перекус «закрывает»
// тягу лучше). Каждый перекус считается по ОСТОРОЖНОЙ калорийности —
// среднее + z·разброс из модели порций, поэтому неоткалиброванная горсть
// занимает больше бюджета, чем проверенная. Подряд один и тот же перекус не
// ставится. Решение — точное ДП: окно × занятый бюджет (шаг 5 ккал) × прошлый перекус.

import { SLOTS, slotOf, slotRemaining } from "./slots.ts";

export const LAST_SLOT = 10; // 8pm–10pm — позже план не ставит
export const PIECES = [0.5, 1, 2] as const;
const STEP = 5;

export type PlanSnack = { id: string; cat: string; mean: number; sd: number; taste: number };
export type Pin = { snack: string; slot: number; pieces: number };
export type Option = { snack: string; slot: number; pieces: number; mean: number; cautious: number; value: number; parts: { taste: number; dim: number; fit: number } };
// busy — окна, где сегодня уже был перекус: план ставит не больше одного перекуса на окно.
export type PlanInput = { minute: number; cap: number; z: number; snacks: PlanSnack[]; rates: number[]; pins: Pin[]; busy?: number[] };
export type DayPlan = { items: Option[]; value: number; used: number; cap: number; feasible: boolean; slots: number[] };

export function dim(pieces: number): number {
  if (pieces <= 0.5) return 0.55;
  let v = 0;
  for (let i = 0; i < pieces; i++) v += Math.pow(0.6, i);
  return v;
}

export function planSlots(minute: number): number[] {
  const out: number[] = [];
  for (let s = slotOf(minute); s <= LAST_SLOT; s++) if (slotRemaining(s, minute) >= 0.25) out.push(s);
  return out;
}

export function option(sn: PlanSnack, slot: number, pieces: number, z: number, rates: number[]): Option {
  const maxRate = Math.max(...rates, 1e-9);
  const fit = 0.55 + 0.45 * (rates[slot] / maxRate);
  const d = dim(pieces);
  // 3 из 5 и ниже — «так себе»: такой перекус план не предлагает вовсе.
  const t = Math.max(0, sn.taste - 3);
  return {
    snack: sn.id,
    slot,
    pieces,
    mean: sn.mean * pieces,
    cautious: (sn.mean + z * sn.sd) * pieces,
    value: t * d * fit,
    parts: { taste: sn.taste, dim: d, fit },
  };
}

export function solvePlan(inp: PlanInput): DayPlan {
  const slots = planSlots(inp.minute).filter((s) => !inp.busy?.includes(s) || inp.pins.some((p) => p.slot === s));
  const C = Math.max(0, Math.floor(inp.cap / STEP));
  const n = inp.snacks.length;
  const idx = new Map(inp.snacks.map((s, i) => [s.id, i]));
  // Варианты по окнам; закреплённое окно получает ровно свой вариант.
  const opts: Option[][] = slots.map((slot) => {
    const pin = inp.pins.find((p) => p.slot === slot);
    if (pin) {
      const sn = inp.snacks.find((x) => x.id === pin.snack);
      return sn ? [option(sn, slot, pin.pieces, inp.z, inp.rates)] : [];
    }
    return inp.snacks.flatMap((sn) => PIECES.map((k) => option(sn, slot, k, inp.z, inp.rates)));
  });
  const pinned = new Set(inp.pins.map((p) => p.slot));
  const m = slots.length;
  const L = n + 1; // last = n — «ничего не было»
  const NEG = -1e18;
  // best[i][c][l] — лучшая ценность с окна i до конца при занятых c шагах и прошлом перекусе l.
  const size = (m + 1) * (C + 1) * L;
  const best = new Float64Array(size).fill(NEG);
  const choice = new Int32Array(size).fill(-2);
  const at = (i: number, c: number, l: number) => (i * (C + 1) + c) * L + l;
  for (let c = 0; c <= C; c++) for (let l = 0; l < L; l++) best[at(m, c, l)] = 0;
  for (let i = m - 1; i >= 0; i--)
    for (let c = 0; c <= C; c++)
      for (let l = 0; l < L; l++) {
        let b = NEG;
        let ch = -2;
        if (!pinned.has(slots[i])) {
          b = best[at(i + 1, c, n)];
          ch = -1;
        }
        opts[i].forEach((o, k) => {
          const si = idx.get(o.snack)!;
          if (si === l && !pinned.has(slots[i])) return;
          const need = Math.ceil(o.cautious / STEP - 1e-9);
          if (c + need > C) return;
          const v = best[at(i + 1, c + need, si)];
          if (v <= NEG / 2) return;
          if (v + o.value > b + 1e-12) {
            b = v + o.value;
            ch = k;
          }
        });
        best[at(i, c, l)] = b;
        choice[at(i, c, l)] = ch;
      }
  const total = best[at(0, 0, n)];
  if (total <= NEG / 2) return { items: [], value: 0, used: 0, cap: inp.cap, feasible: false, slots };
  const items: Option[] = [];
  let c = 0;
  let l = n;
  for (let i = 0; i < m; i++) {
    const ch = choice[at(i, c, l)];
    if (ch < 0) {
      l = n;
      continue;
    }
    const o = opts[i][ch];
    items.push(o);
    c += Math.ceil(o.cautious / STEP - 1e-9);
    l = idx.get(o.snack)!;
  }
  return { items, value: total, used: items.reduce((s, o) => s + o.cautious, 0), cap: inp.cap, feasible: true, slots };
}

// Окно для «хочу X» по умолчанию — ближайшее, где обычно тянет сильнее всего.
export function bestSlotFor(minute: number, rates: number[]): number {
  const ss = planSlots(minute);
  return ss.reduce((a, b) => (rates[b] > rates[a] ? b : a), ss[0] ?? Math.min(LAST_SLOT, slotOf(minute)));
}

export { SLOTS };
