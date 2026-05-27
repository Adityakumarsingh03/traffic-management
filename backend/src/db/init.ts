import fs from 'fs';
import path from 'path';
import type { SqlJsStatic, Database, BindParams } from 'sql.js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require('sql.js') as (config?: unknown) => Promise<SqlJsStatic>;

const DB_PATH = path.join(__dirname, '..', '..', 'traffic.db');
let _db: Database | null = null;
let _SQL: SqlJsStatic | null = null;

function saveDb(): void {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── compatibility shim mimicking better-sqlite3 API ──────────────────────────
export interface PreparedStatement {
  run(params?: Record<string, unknown> | unknown[]): { changes: number; lastInsertRowid: number };
  get(params?: unknown[] | unknown): Record<string, unknown> | undefined;
  all(params?: unknown[] | unknown): Record<string, unknown>[];
}

type SqlParam = string | number | null | Uint8Array;
type SqlParamMap = Record<string, SqlParam>;

function toSqlParams(
  params?: Record<string, unknown> | unknown[] | unknown
): BindParams | undefined {
  if (params === undefined || params === null) return undefined;
  if (Array.isArray(params)) return params as SqlParam[];
  if (typeof params === 'object') {
    // Convert @key -> :key for sql.js
    const result: SqlParamMap = {};
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      const key = k.startsWith(':') ? k : `:${k}`;
      result[key] = v as SqlParam;
    }
    return result;
  }
  // single positional arg
  return [params as SqlParam];
}

function makeStatement(sql: string): PreparedStatement {
  return {
    run(params) {
      if (!_db) throw new Error('DB not initialized. Call initDb() first.');
      const p = toSqlParams(params);
      _db.run(sql, p);
      saveDb();
      return { changes: 1, lastInsertRowid: 0 };
    },
    get(params) {
      if (!_db) throw new Error('DB not initialized. Call initDb() first.');
      const stmt = _db.prepare(sql);
      try {
        const p = toSqlParams(params);
        if (p !== undefined) stmt.bind(p);
        if (stmt.step()) {
          return stmt.getAsObject() as Record<string, unknown>;
        }
        return undefined;
      } finally {
        stmt.free();
      }
    },
    all(params) {
      if (!_db) throw new Error('DB not initialized. Call initDb() first.');
      const rows: Record<string, unknown>[] = [];
      const stmt = _db.prepare(sql);
      try {
        const p = toSqlParams(params);
        if (p !== undefined) stmt.bind(p);
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as Record<string, unknown>);
        }
        return rows;
      } finally {
        stmt.free();
      }
    },
  };
}

export interface BetterDb {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): void;
  transaction(fn: () => void): () => void;
  pragma(_s: string): void;
}

export function getDb(): BetterDb {
  if (!_db) throw new Error('DB not initialized. Call initDb() first.');

  return {
    prepare: (sql) => makeStatement(sql),
    exec(sql) {
      if (!_db) throw new Error('DB not initialized.');
      _db.exec(sql);
      saveDb();
    },
    transaction(fn) {
      return () => {
        if (!_db) throw new Error('DB not initialized.');
        // sql.js is in-memory: no BEGIN/COMMIT needed — just run fn then persist
        fn();
        saveDb();
      };
    },
    pragma(_s: string) { /* no-op shim */ },
  };
}

// ── async init — call once at server startup ──────────────────────────────────
// Pass dbPath=':memory:' (or null) for an ephemeral in-memory database (tests).
export async function initDb(dbPath?: string | null): Promise<void> {
  if (_db) return; // already initialized

  _SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(path.dirname(require.resolve('sql.js')), file),
  });

  const targetPath = dbPath === undefined ? DB_PATH : dbPath;

  if (targetPath && fs.existsSync(targetPath)) {
    const buf = fs.readFileSync(targetPath);
    _db = new _SQL.Database(new Uint8Array(buf));
  } else {
    _db = new _SQL.Database(); // fresh in-memory DB
  }

  createSchema();
}

export function resetDb(): void {
  _db = null; // allow re-init (for test isolation)
}

function createSchema(): void {
  if (!_db) return;
  _db.exec(`
    CREATE TABLE IF NOT EXISTS junctions (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS roads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      junction_id INTEGER NOT NULL,
      direction TEXT NOT NULL,
      road_name TEXT NOT NULL,
      UNIQUE (junction_id, direction),
      FOREIGN KEY (junction_id) REFERENCES junctions(id)
    );

    CREATE TABLE IF NOT EXISTS vehicle_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      road_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      cars INTEGER DEFAULT 0,
      bikes INTEGER DEFAULT 0,
      buses INTEGER DEFAULT 0,
      mini_trucks INTEGER DEFAULT 0,
      medium_trucks INTEGER DEFAULT 0,
      big_trucks INTEGER DEFAULT 0,
      cycles INTEGER DEFAULT 0,
      FOREIGN KEY (road_id) REFERENCES roads(id)
    );

    CREATE TABLE IF NOT EXISTS signal_timers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      junction_id INTEGER NOT NULL,
      direction TEXT NOT NULL,
      green_time INTEGER DEFAULT 30,
      red_time INTEGER DEFAULT 60,
      yellow_time INTEGER DEFAULT 5,
      updated_at TEXT NOT NULL
    );
  `);
  saveDb();
}
