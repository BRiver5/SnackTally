// Частые штучные перекусы с калорийностью по этикетке на одну единицу —
// добавляются в кладовую одним тапом.
export const PRESETS: { name: string; cat: string; unit: string; kcal: number }[] = [
  { name: "Almonds", cat: "Nuts", unit: "handful", kcal: 160 },
  { name: "Cashews", cat: "Nuts", unit: "handful", kcal: 155 },
  { name: "Dark chocolate", cat: "Sweet", unit: "square", kcal: 55 },
  { name: "Gummy bears", cat: "Sweet", unit: "handful", kcal: 90 },
  { name: "Apple", cat: "Fruit", unit: "piece", kcal: 95 },
  { name: "Banana", cat: "Fruit", unit: "piece", kcal: 105 },
  { name: "Grapes", cat: "Fruit", unit: "handful", kcal: 35 },
  { name: "Potato chips", cat: "Salty", unit: "handful", kcal: 75 },
  { name: "Pretzels", cat: "Salty", unit: "handful", kcal: 60 },
  { name: "Popcorn", cat: "Salty", unit: "cup", kcal: 35 },
  { name: "Greek yogurt", cat: "Dairy", unit: "cup", kcal: 130 },
  { name: "Cheese", cat: "Dairy", unit: "slice", kcal: 110 },
  { name: "Cookie", cat: "Baked", unit: "cookie", kcal: 80 },
  { name: "Granola bar", cat: "Baked", unit: "bar", kcal: 190 },
  { name: "Croissant", cat: "Baked", unit: "piece", kcal: 230 },
];

export const UNITS = ["piece", "handful", "square", "cup", "slice", "bar", "cookie"] as const;
