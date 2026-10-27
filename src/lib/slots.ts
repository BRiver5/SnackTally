// День делится на 12 двухчасовых окон — единица и для модели темпа, и для плана.
export const SLOTS = 12;
export const SLOT_MIN = 120;

export function slotOf(minute: number): number {
  return Math.min(SLOTS - 1, Math.max(0, Math.floor(minute / SLOT_MIN)));
}

export function slotLabel(s: number): string {
  const h = s * 2;
  const fmt = (x: number) => (x === 0 || x === 24 ? "12am" : x === 12 ? "12pm" : x < 12 ? `${x}am` : `${x - 12}pm`);
  return `${fmt(h)}–${fmt(h + 2)}`;
}

export function clock(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = Math.round(minute % 60);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

// Какая доля окна s ещё впереди, если сейчас minute.
export function slotRemaining(s: number, minute: number): number {
  const start = s * SLOT_MIN;
  const end = start + SLOT_MIN;
  if (minute <= start) return 1;
  if (minute >= end) return 0;
  return (end - minute) / SLOT_MIN;
}
