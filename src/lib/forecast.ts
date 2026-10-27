// Прогноз конца дня: уже съеденное (среднее и разброс по модели порций) плюс
// «как обычно» на оставшиеся окна — составной Пуассон: число перекусов в окне
// ~ Пуассон(λ окна × доля окна впереди), калорийность одного перекуса — по
// своей истории. Шанс уложиться в бюджет — нормальное приближение суммы.

import { SLOTS, slotOf, slotRemaining } from "./slots.ts";

export type EatenItem = { mean: number; sd: number; minute: number };
export type EventKcal = { mean: number; sd: number };
export type SlotForecast = { s: number; lambda: number; frac: number; kcal: number };
export type Forecast = { eatenMean: number; eatenSd: number; slots: SlotForecast[]; restMean: number; mean: number; sd: number; pIn: number; budget: number };

export function phi(x: number): number {
  // Абрамовиц — Стиган 7.1.26 для erf.
  const t = 1 / (1 + 0.3275911 * Math.abs(x / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// Калорийность одного перекуса по истории, стянутая к 140 ± 70 ккал.
export function eventKcal(history: number[]): EventKcal {
  const k = 5;
  const n = history.length;
  const m = (k * 140 + history.reduce((s, x) => s + x, 0)) / (k + n);
  const v = (k * 70 * 70 + history.reduce((s, x) => s + (x - m) ** 2, 0)) / (k + n);
  return { mean: m, sd: Math.sqrt(v) };
}

export function forecast(minute: number, eaten: EatenItem[], rates: number[], ev: EventKcal, budget: number): Forecast {
  const eatenMean = eaten.reduce((s, e) => s + e.mean, 0);
  const eatenVar = eaten.reduce((s, e) => s + e.sd * e.sd, 0);
  const slots: SlotForecast[] = [];
  let lam = 0;
  for (let s = slotOf(minute); s < SLOTS; s++) {
    const frac = slotRemaining(s, minute);
    if (frac <= 0) continue;
    const lambda = rates[s] * frac;
    lam += lambda;
    slots.push({ s, lambda, frac, kcal: lambda * ev.mean });
  }
  const restMean = lam * ev.mean;
  const restVar = lam * (ev.sd * ev.sd + ev.mean * ev.mean);
  const mean = eatenMean + restMean;
  const sd = Math.sqrt(eatenVar + restVar);
  const pIn = sd > 0 ? phi((budget - mean) / sd) : mean <= budget ? 1 : 0;
  return { eatenMean, eatenSd: Math.sqrt(eatenVar), slots, restMean, mean, sd, pIn, budget };
}

export const Z_FOR: Record<string, number> = { "0.7": 0.524, "0.8": 0.842, "0.9": 1.282 };
