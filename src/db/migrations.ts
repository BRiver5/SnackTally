import type { SQLiteDatabase } from "expo-sqlite";

// Каждая миграция — одна ступень схемы. Не редактируй уже выпущенную миграцию —
// добавляй новую в конец массива. PRAGMA user_version хранит номер последней
// применённой ступени, миграции применяются последовательно от текущего значения.
const migrations: string[] = [
  `
  CREATE TABLE IF NOT EXISTS snacks (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    cat TEXT NOT NULL,
    unit TEXT NOT NULL,
    label_kcal REAL NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY NOT NULL,
    day TEXT NOT NULL,
    minute INTEGER NOT NULL,
    snack_id TEXT NOT NULL,
    pieces REAL NOT NULL,
    kcal REAL NOT NULL,
    rating INTEGER
  );
  CREATE TABLE IF NOT EXISTS checks (
    id TEXT PRIMARY KEY NOT NULL,
    snack_id TEXT NOT NULL,
    day TEXT NOT NULL,
    kcal REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS model (
    key TEXT PRIMARY KEY NOT NULL,
    json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const currentVersion = row?.user_version ?? 0;

  for (let i = currentVersion; i < migrations.length; i++) {
    await db.execAsync(migrations[i]);
    await db.execAsync(`PRAGMA user_version = ${i + 1};`);
  }
}
