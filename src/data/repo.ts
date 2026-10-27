// Слой данных поверх expo-sqlite. Все функции — через один мьютекс (цепочка
// промисов), иначе параллельные транзакции expo-sqlite отклоняются.

import { getDb } from "../db/client";
import { generateId } from "../lib/id";
import { MODEL_VERSION, addCheck as addCheckModel, addRating, estimate, freshPace, freshPortion, observeDay, type Pace, type Portion, type Taste } from "../lib/models";
import { SLOTS, slotOf } from "../lib/slots";
import type { Pin } from "../lib/planner";

export type Snack = { id: string; name: string; cat: string; unit: string; label_kcal: number; archived: number };
export type Log = { id: string; day: string; minute: number; snack_id: string; pieces: number; kcal: number; rating: number | null };
export type Check = { id: string; snack_id: string; day: string; kcal: number };
export type Settings = { budget: number; target: "0.7" | "0.8" | "0.9"; flex: boolean; haptics: boolean };
export const DEFAULT_SETTINGS: Settings = { budget: 450, target: "0.8", flex: true, haptics: true };

export type Models = { portions: Record<string, Portion>; tastes: Record<string, Taste>; catTastes: Record<string, Taste>; pace: Pace; paceDay: string | null };

let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

async function put(key: string, v: unknown) {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO model (key, json) VALUES (?, ?);", [key, JSON.stringify(v)]);
}

function dayCounts(logs: Log[], day: string): number[] {
  const c = Array(SLOTS).fill(0);
  for (const l of logs) if (l.day === day) c[slotOf(l.minute)]++;
  return c;
}

// Полная пересборка всех трёх моделей из журнала — при смене констант или правке прошлого.
async function rebuild(today: string) {
  const db = await getDb();
  const snacks = await db.getAllAsync<Snack>("SELECT * FROM snacks;");
  const logs = await db.getAllAsync<Log>("SELECT * FROM logs ORDER BY day ASC, minute ASC, rowid ASC;");
  const checks = await db.getAllAsync<Check>("SELECT * FROM checks ORDER BY day ASC, rowid ASC;");
  await db.runAsync("DELETE FROM model;");
  const catOf = new Map(snacks.map((s) => [s.id, s.cat]));
  const portions: Record<string, Portion> = {};
  for (const c of checks) portions[c.snack_id] = addCheckModel(portions[c.snack_id] ?? freshPortion(), c.kcal);
  const tastes: Record<string, Taste> = {};
  const catTastes: Record<string, Taste> = {};
  for (const l of logs)
    if (l.rating != null) {
      tastes[l.snack_id] = addRating(tastes[l.snack_id], l.rating);
      const cat = catOf.get(l.snack_id) ?? "Other";
      catTastes[cat] = addRating(catTastes[cat], l.rating);
    }
  let pace = freshPace();
  const days = [...new Set(logs.map((l) => l.day))].filter((d) => d < today).sort();
  for (const d of days) pace = observeDay(pace, dayCounts(logs, d));
  for (const [k, v] of Object.entries(portions)) await put(`portion:${k}`, v);
  for (const [k, v] of Object.entries(tastes)) await put(`taste:${k}`, v);
  for (const [k, v] of Object.entries(catTastes)) await put(`cat:${k}`, v);
  await put("pace", pace);
  await put("paceDay", days[days.length - 1] ?? null);
}

export function loadAll(today: string) {
  return locked(async () => {
    const db = await getDb();
    const srows = await db.getAllAsync<{ key: string; value: string }>("SELECT * FROM settings;");
    const raw: Record<string, string> = Object.fromEntries(srows.map((r) => [r.key, r.value]));
    if (raw.model_version !== String(MODEL_VERSION)) {
      await rebuild(today);
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('model_version', ?);", [String(MODEL_VERSION)]);
    }
    const snacks = await db.getAllAsync<Snack>("SELECT * FROM snacks ORDER BY name COLLATE NOCASE;");
    const logs = await db.getAllAsync<Log>("SELECT * FROM logs ORDER BY day DESC, minute DESC, rowid DESC;");
    const checks = await db.getAllAsync<Check>("SELECT * FROM checks ORDER BY day DESC, rowid DESC;");
    const mrows = await db.getAllAsync<{ key: string; json: string }>("SELECT * FROM model;");
    const models: Models = { portions: {}, tastes: {}, catTastes: {}, pace: freshPace(), paceDay: null };
    for (const r of mrows) {
      const v = JSON.parse(r.json);
      if (r.key.startsWith("portion:")) models.portions[r.key.slice(8)] = v;
      else if (r.key.startsWith("taste:")) models.tastes[r.key.slice(6)] = v;
      else if (r.key.startsWith("cat:")) models.catTastes[r.key.slice(4)] = v;
      else if (r.key === "pace") models.pace = v;
      else if (r.key === "paceDay") models.paceDay = v;
    }
    // Темп учится по закрытым дням: каждый новый прошедший день с записями — одно наблюдение.
    const closed = [...new Set(logs.map((l) => l.day))].filter((d) => d < today && (!models.paceDay || d > models.paceDay)).sort();
    if (closed.length) {
      for (const d of closed) models.pace = observeDay(models.pace, dayCounts(logs, d));
      models.paceDay = closed[closed.length - 1];
      await put("pace", models.pace);
      await put("paceDay", models.paceDay);
    }
    const settings: Settings = { ...DEFAULT_SETTINGS };
    if (raw.budget) settings.budget = Number(raw.budget);
    if (raw.target === "0.7" || raw.target === "0.8" || raw.target === "0.9") settings.target = raw.target;
    if (raw.flex) settings.flex = raw.flex === "1";
    if (raw.haptics) settings.haptics = raw.haptics === "1";
    const pins: Pin[] = raw[`pins:${today}`] ? JSON.parse(raw[`pins:${today}`]) : [];
    const flexUsed = Number(raw[`flex:${today}`] ?? 0);
    return { snacks, logs, checks, models, settings, pins, flexUsed };
  });
}

export function addSnack(name: string, cat: string, unit: string, label: number) {
  return locked(async () => {
    const db = await getDb();
    const found = await db.getFirstAsync<Snack>("SELECT * FROM snacks WHERE name = ? COLLATE NOCASE;", [name.trim()]);
    if (found) {
      if (found.archived) await db.runAsync("UPDATE snacks SET archived = 0 WHERE id = ?;", [found.id]);
      return found.id;
    }
    const id = generateId();
    await db.runAsync("INSERT INTO snacks (id, name, cat, unit, label_kcal, archived) VALUES (?, ?, ?, ?, ?, 0);", [id, name.trim(), cat, unit, label]);
    return id;
  });
}

export function archiveSnack(id: string, archived: boolean) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("UPDATE snacks SET archived = ? WHERE id = ?;", [archived ? 1 : 0, id]);
  });
}

export function updateSnackLabel(id: string, label: number) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("UPDATE snacks SET label_kcal = ? WHERE id = ?;", [label, id]);
  });
}

async function portionMean(snackId: string): Promise<number> {
  const db = await getDb();
  const s = await db.getFirstAsync<Snack>("SELECT * FROM snacks WHERE id = ?;", [snackId]);
  const r = await db.getFirstAsync<{ json: string }>("SELECT json FROM model WHERE key = ?;", [`portion:${snackId}`]);
  return estimate(r ? JSON.parse(r.json) : freshPortion(), s?.label_kcal ?? 100).mean;
}

export function logSnack(snackId: string, pieces: number, day: string, minute: number) {
  return locked(async () => {
    const db = await getDb();
    // Калории записи — снимок модели порции на момент перекуса.
    const kcal = (await portionMean(snackId)) * pieces;
    const id = generateId();
    await db.runAsync("INSERT INTO logs (id, day, minute, snack_id, pieces, kcal, rating) VALUES (?, ?, ?, ?, ?, ?, NULL);", [id, day, minute, snackId, pieces, kcal]);
    return id;
  });
}

export function rateLog(id: string, rating: number, today: string) {
  return locked(async () => {
    const db = await getDb();
    const l = await db.getFirstAsync<Log>("SELECT * FROM logs WHERE id = ?;", [id]);
    if (!l) return;
    await db.runAsync("UPDATE logs SET rating = ? WHERE id = ?;", [rating, id]);
    if (l.rating == null) {
      const s = await db.getFirstAsync<Snack>("SELECT * FROM snacks WHERE id = ?;", [l.snack_id]);
      const cat = s?.cat ?? "Other";
      const t = await db.getFirstAsync<{ json: string }>("SELECT json FROM model WHERE key = ?;", [`taste:${l.snack_id}`]);
      const c = await db.getFirstAsync<{ json: string }>("SELECT json FROM model WHERE key = ?;", [`cat:${cat}`]);
      await put(`taste:${l.snack_id}`, addRating(t ? JSON.parse(t.json) : undefined, rating));
      await put(`cat:${cat}`, addRating(c ? JSON.parse(c.json) : undefined, rating));
    } else await rebuild(today); // переоценка старой записи — пересобрать по порядку
  });
}

export function deleteLog(id: string, today: string) {
  return locked(async () => {
    const db = await getDb();
    const l = await db.getFirstAsync<Log>("SELECT * FROM logs WHERE id = ?;", [id]);
    await db.runAsync("DELETE FROM logs WHERE id = ?;", [id]);
    if (l && (l.rating != null || l.day < today)) await rebuild(today);
  });
}

export function setPieces(id: string, pieces: number) {
  return locked(async () => {
    const db = await getDb();
    const l = await db.getFirstAsync<Log>("SELECT * FROM logs WHERE id = ?;", [id]);
    if (!l) return;
    await db.runAsync("UPDATE logs SET pieces = ?, kcal = ? WHERE id = ?;", [pieces, (l.kcal / l.pieces) * pieces, id]);
  });
}

export function addCheck(snackId: string, kcal: number, day: string) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("INSERT INTO checks (id, snack_id, day, kcal) VALUES (?, ?, ?, ?);", [generateId(), snackId, day, kcal]);
    const r = await db.getFirstAsync<{ json: string }>("SELECT json FROM model WHERE key = ?;", [`portion:${snackId}`]);
    await put(`portion:${snackId}`, addCheckModel(r ? JSON.parse(r.json) : freshPortion(), kcal));
  });
}

export function saveSetting(key: string, value: string) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);", [key, value]);
  });
}

export function resetAll() {
  return locked(async () => {
    const db = await getDb();
    for (const t of ["snacks", "logs", "checks", "model"]) await db.runAsync(`DELETE FROM ${t};`);
    await db.runAsync("DELETE FROM settings WHERE key LIKE 'pins:%' OR key LIKE 'flex:%';");
  });
}
