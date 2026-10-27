// Палитра Snack Tally: сливовое варенье на светлой «фисташковой» бумаге.
// Компоненты и экраны берут цвета только отсюда.

export const light = {
  background: "#F3F4EE",
  backgroundAlt: "#E9EBE2",
  surface: "#FFFFFF",
  surfaceAlt: "#F6F6F2",
  border: "#E1E3D8",
  ink: "#261A2B",
  inkMuted: "#665C6B",
  inkFaint: "#A39CA6",
  onAccent: "#FFFFFF",
  accent: "#750E81",
  accentSoft: "#F1E2F3",
  // Укладываемся — фисташка, на грани — янтарь, мимо — клюква.
  pistachio: "#5E7F2A",
  pistachioSoft: "#E6EED5",
  amber: "#B5700F",
  amberSoft: "#F7EAD3",
  danger: "#B42838",
  success: "#5E7F2A",
  signal: "#9C5F12",
  // Командная панель снизу.
  bar: "#261A2B",
  barInk: "#F1E2F3",
  scrim: "rgba(38,26,43,0.45)",
  statusDimmed: "#979296",
};

export const dark = {
  background: "#141016",
  backgroundAlt: "#1B161E",
  surface: "#221C26",
  surfaceAlt: "#2A2330",
  border: "#352D3B",
  ink: "#F2ECF4",
  inkMuted: "#B2A8B6",
  inkFaint: "#776E7B",
  onAccent: "#FFFFFF",
  accent: "#B65AC2",
  accentSoft: "#3A2440",
  pistachio: "#9CC062",
  pistachioSoft: "#26301A",
  amber: "#E0A040",
  amberSoft: "#3A2C17",
  danger: "#E0606E",
  success: "#9CC062",
  signal: "#E0A040",
  bar: "#0B080C",
  barInk: "#F1E2F3",
  scrim: "rgba(0,0,0,0.6)",
  statusDimmed: "#09070A",
};

export type Palette = typeof light;

export const CATS = ["Sweet", "Salty", "Nuts", "Fruit", "Dairy", "Baked"] as const;
export const CAT_COLORS: Record<string, string> = {
  Sweet: "#A33A77",
  Salty: "#C7861C",
  Nuts: "#8A5A34",
  Fruit: "#5E7F2A",
  Dairy: "#4F7FA8",
  Baked: "#C25F3A",
  Other: "#7E7684",
};
