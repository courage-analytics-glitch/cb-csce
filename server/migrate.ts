import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL is not configured; migration skipped in explicit demo mode.");
  process.exit(0);
}

const connection = await mysql.createConnection(url);
try {
  const sql = await fs.readFile(path.resolve("drizzle/0000_initial.sql"), "utf8");
  for (const statement of sql.split(";")) {
    const trimmed = statement.trim();
    if (trimmed) await connection.query(trimmed);
  }
  console.log("CB-CSCE schema migration applied.");
} finally {
  await connection.end();
}
