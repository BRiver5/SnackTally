// Три накапливаемые модели. Каждая обновляется на месте одним наблюдением и
// хранится в базе; при смене констант (MODEL_VERSION) — пересборка из журнала.
//
// • Порция: «сколько ккал на самом деле в моей горсти/дольке» — взвешенные
//   суммы проверок с забыванием поверх этикетки как априора.
// • Вкус: «стоило ли того» (1–5) по перекусу — с забыванием, сжатие к
//   категории и ко всему.
// • Темп: сколько перекусов обычно случается в каждом двухчасовом окне —
//   гамма-пуассон по закрытым дням с забыванием.

import { SLOTS } from "./slots.ts";

export const MODEL_VERSION = 1;
export const FORGET_CHECK = 0.85;
export const FORGET_RATING = 0.9;
export const FORGET_DAY = 0.95;

// ── порция ──────────────────────────────────────────────────────────
export type Portion = { w: number; sx: number; sxx: number };
export const PRIOR_STRENGTH = 2;
export const PRIOR_CV = 0.25;

export function freshPortion(): Portion {
  return { w: 0, sx: 0, sxx: 0 };
}

export function addCheck(p: Portion, kcal: number): Portion {
  return { w: p.w * FORGET_CHECK + 1, sx: p.sx * FORGET_CHECK + kcal, sxx: p.sxx * FORGET_CHECK + kcal * kcal };
}

export type PortionEstimate = { mean: number; sd: number; label: number; checks: number; drift: number };

// Среднее — этикетка с весом PRIOR_STRENGTH плюс проверки; разброс одной
// порции — разброс проверок, стянутый к 25% этикетки, плюс неуверенность в среднем.
export function estimate(p: Portion, label: number): PortionEstimate {
  const n = p.w;
  const mean = (PRIOR_STRENGTH * label + p.sx) / (PRIOR_STRENGTH + n);
  const priorVar = (PRIOR_CV * label) ** 2;
  const sampleVar = n > 0 ? Math.max(0, p.sxx / n - (p.sx / n) ** 2) : 0;
  const between = (PRIOR_STRENGTH * priorVar + n * sampleVar) / (PRIOR_STRENGTH + n);
  const se2 = between / (PRIOR_STRENGTH + n);
  return { mean, sd: Math.sqrt(between + se2), label, checks: n, drift: label > 0 ? mean / label - 1 : 0 };
}

// ── вкус ───────────────────────────────────────────────────────────
export type Taste = { w: number; s: number };
export const GLOBAL_TASTE = 3.4;
const K_CAT = 3;
const K_SNACK = 2;

export function addRating(t: Taste | undefined, r: number): Taste {
  const b = t ?? { w: 0, s: 0 };
  return { w: b.w * FORGET_RATING + 1, s: b.s * FORGET_RATING + r };
}

export type TasteEstimate = { value: number; category: number; own: number | null; n: number };

export function taste(snack: Taste | undefined, cat: Taste | undefined): TasteEstimate {
  const c = cat ?? { w: 0, s: 0 };
  const catM = (c.s + K_CAT * GLOBAL_TASTE) / (c.w + K_CAT);
  const t = snack ?? { w: 0, s: 0 };
  const value = (t.s + K_SNACK * catM) / (t.w + K_SNACK);
  return { value, category: catM, own: t.w > 0 ? t.s / t.w : null, n: t.w };
}

// ── темп ───────────────────────────────────────────────────────────
export type Pace = { a: number[]; b: number[] };
const A0 = 0.3;
const B0 = 1;

export function freshPace(): Pace {
  return { a: Array(SLOTS).fill(0), b: Array(SLOTS).fill(0) };
}

// Один закрытый день с записями: counts[s] — сколько перекусов было в окне s.
export function observeDay(p: Pace, counts: number[]): Pace {
  return { a: p.a.map((x, s) => x * FORGET_DAY + (counts[s] ?? 0)), b: p.b.map((x) => x * FORGET_DAY + 1) };
}

export function rate(p: Pace, s: number): number {
  return (p.a[s] + A0) / (p.b[s] + B0);
}

export function rates(p: Pace): number[] {
  return Array.from({ length: SLOTS }, (_, s) => rate(p, s));
}
