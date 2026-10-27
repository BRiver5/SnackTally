import { useMemo } from "react";
import { useApp } from "../store/appStore";
import type { Log, Snack } from "../data/repo";
import { estimate, freshPortion, rates as paceRates, taste, type PortionEstimate, type TasteEstimate } from "../lib/models";
import { eventKcal, forecast, Z_FOR, type Forecast } from "../lib/forecast";
import { solvePlan, type DayPlan, type Pin, type PlanInput, type PlanSnack } from "../lib/planner";
import { resolvePin, type PinConflict } from "../lib/conflicts";
import { addDays, weekStart } from "../lib/time";
import { slotOf } from "../lib/slots";

export type SnackInfo = Snack & { portion: PortionEstimate; taste: TasteEstimate };

export type Day = {
  info: Map<string, SnackInfo>;
  todayLogs: Log[];
  rates: number[];
  fc: Forecast;
  z: number;
  budget: number;
  cap: number;
  plan: DayPlan;
  conflict: PinConflict | null;
  bank: number;
  input: PlanInput;
  planSnacks: PlanSnack[];
  name: (id: string) => string;
  build: (o: { eatNow?: { snack: string; pieces: number }; pins?: Pin[]; cap?: number }) => { fc: Forecast; plan: DayPlan };
};

// Лишний запас недели: недоедание прошлых дней этой недели (только дни с
// записями, не больше 150 ккал за день), перебор — вычитается.
export function flexBank(logs: Log[], today: string, budget: number): number {
  const start = weekStart(today);
  let bank = 0;
  for (let d = start; d < today; d = addDays(d, 1)) {
    const day = logs.filter((l) => l.day === d);
    if (!day.length) continue;
    bank += Math.min(150, budget - day.reduce((s, l) => s + l.kcal, 0));
  }
  return Math.max(0, bank);
}

export function useDay(): Day {
  const version = useApp((s) => s.version);
  return useMemo(() => {
    const st = useApp.getState();
    const info = new Map<string, SnackInfo>(
      st.snacks.map((s) => [s.id, { ...s, portion: estimate(st.models.portions[s.id] ?? freshPortion(), s.label_kcal), taste: taste(st.models.tastes[s.id], st.models.catTastes[s.cat]) }])
    );
    const name = (id: string) => info.get(id)?.name ?? "Snack";
    const todayLogs = st.logs.filter((l) => l.day === st.today);
    const rates = paceRates(st.models.pace);
    const ev = eventKcal(st.logs.slice(0, 60).map((l) => l.kcal));
    const z = Z_FOR[st.settings.target];
    const budget = st.settings.budget + st.flexUsed;
    const eatenOf = (logs: { snack_id: string; pieces: number; minute: number }[]) =>
      logs.map((l) => {
        const p = info.get(l.snack_id)?.portion;
        return { mean: (p?.mean ?? 100) * l.pieces, sd: (p?.sd ?? 25) * l.pieces, minute: l.minute };
      });
    const planSnacks: PlanSnack[] = [...info.values()].filter((s) => !s.archived).map((s) => ({ id: s.id, cat: s.cat, mean: s.portion.mean, sd: s.portion.sd, taste: s.taste.value }));
    const curSlot = slotOf(st.minute);
    const pins = st.pins.filter((p) => p.slot >= curSlot && info.has(p.snack));

    const build = (o: { eatNow?: { snack: string; pieces: number }; pins?: Pin[]; cap?: number }) => {
      const logs = o.eatNow ? [...todayLogs, { snack_id: o.eatNow.snack, pieces: o.eatNow.pieces, minute: st.minute }] : todayLogs;
      const eaten = eatenOf(logs);
      const fc = forecast(st.minute, eaten, rates, ev, budget);
      const cap = o.cap ?? budget - fc.eatenMean - z * fc.eatenSd;
      const plan = solvePlan({ minute: st.minute, cap, z, snacks: planSnacks, rates, pins: o.pins ?? [] });
      return { fc, plan };
    };

    const fc = forecast(st.minute, eatenOf(todayLogs), rates, ev, budget);
    const cap = budget - fc.eatenMean - z * fc.eatenSd;
    const input: PlanInput = { minute: st.minute, cap, z, snacks: planSnacks, rates, pins: [] };
    const bank = st.settings.flex ? Math.max(0, flexBank(st.logs, st.today, st.settings.budget) - st.flexUsed) : 0;
    // Закреплённое желание, которое не влезает, план не ломает: план строится без него, а конфликт объясняет.
    let plan = solvePlan({ ...input, pins });
    let conflict: PinConflict | null = null;
    if (!plan.feasible && pins.length) {
      conflict = resolvePin({ ...input, pins: [] }, pins[0], { bank, name, checks: (id) => info.get(id)?.portion.checks ?? 0 });
      plan = solvePlan({ ...input, pins: pins.slice(1) });
      if (!plan.feasible) plan = solvePlan(input);
    }
    return { info, todayLogs, rates, fc, z, budget, cap, plan, conflict, bank, input: { ...input, pins }, planSnacks, name, build };
  }, [version]);
}
