import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, RowDataPacket } from "mysql2/promise";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrations = ["0000_initial.sql", "0001_operational_records.sql"];

async function applySqlFile(pool: Pool, fileName: string): Promise<void> {
  const sql = await fs.readFile(path.join(projectRoot, "drizzle", fileName), "utf8");
  for (const statement of sql.split(";")) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    try {
      await pool.query(trimmed);
    } catch (error) {
      const code = (error as { code?: string }).code;
      // Additive migrations are allowed to be replayed against a partially upgraded
      // shared database. Only known duplicate-schema errors are ignored.
      if (code === "ER_DUP_FIELDNAME" || code === "ER_DUP_KEYNAME") continue;
      throw error;
    }
  }
}

export async function migratePool(pool: Pool): Promise<void> {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (version varchar(80) PRIMARY KEY, applied_at datetime NOT NULL)");
  const [rows] = await pool.query<(RowDataPacket & { version: string })[]>("SELECT version FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.version));
  for (const migration of migrations) {
    if (applied.has(migration)) continue;
    await applySqlFile(pool, migration);
    await pool.query("INSERT INTO schema_migrations (version, applied_at) VALUES (?, UTC_TIMESTAMP())", [migration]);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("DATABASE_URL is not configured; migration skipped in explicit demo mode.");
    process.exit(0);
  }
  const mysql = await import("mysql2/promise");
  const pool = mysql.createPool(databaseUrl);
  try {
    await migratePool(pool);
    console.log("CB-CSCE schema migrations applied.");
  } finally {
    await pool.end();
  }
}
