import { create } from "zustand";
import { loadAll, DEFAULT_SETTINGS, type Check, type Log, type Models, type Settings, type Snack } from "../data/repo";
import { freshPace } from "../lib/models";
import type { Pin } from "../lib/planner";
import { todayLocal } from "../lib/time";
import { setHapticsEnabled } from "../services/haptics";

function nowMinute(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

type State = {
  ready: boolean;
  version: number;
  today: string;
  minute: number;
  snacks: Snack[];
  logs: Log[];
  checks: Check[];
  models: Models;
  settings: Settings;
  pins: Pin[];
  flexUsed: number;
  refresh: () => Promise<void>;
};

// refresh() — через очередь: два перезапроса внахлёст не перетирают друг друга.
let queue: Promise<void> = Promise.resolve();

export const useApp = create<State>((set) => ({
  ready: false,
  version: 0,
  today: todayLocal(),
  minute: nowMinute(),
  snacks: [],
  logs: [],
  checks: [],
  models: { portions: {}, tastes: {}, catTastes: {}, pace: freshPace(), paceDay: null },
  settings: DEFAULT_SETTINGS,
  pins: [],
  flexUsed: 0,
  refresh: () => {
    queue = queue
      .then(async () => {
        const today = todayLocal();
        const d = await loadAll(today);
        setHapticsEnabled(d.settings.haptics);
        set((s) => ({ ...d, ready: true, today, minute: nowMinute(), version: s.version + 1 }));
      })
      .catch(() => {});
    return queue;
  },
}));
