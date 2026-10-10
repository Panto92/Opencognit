import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const localDir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(localDir, 'migrations');

// ─── Database type detection ──────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
const isPg = !!DATABASE_URL;

// ─── SQLite setup ─────────────────────────────────────────────────────────────
let db: any;
let sqlite: any = null;

if (!isPg) {
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('./schema.js');

  const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
  const DATA_DIR = path.join(process.cwd(), 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const DB_PATH = isTest ? ':memory:' : path.join(DATA_DIR, 'opencognit.db');
  sqlite = new Database(DB_PATH);
  if (!isTest) {
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = NORMAL');  // Faster writes, still crash-safe with WAL
    sqlite.pragma('cache_size = -32000');   // 32MB page cache for better read performance
  }
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('temp_store = memory');   // Temp tables in memory
  sqlite.pragma('busy_timeout = 5000');   // Wait up to 5s on SQLITE_BUSY instead of crashing

  db = drizzle(sqlite, { schema });
  if (isTest) {
    console.log('🗄️  SQLite Test-Datenbank (:memory:)');
  } else {
    console.log('🗄️  SQLite Datenbank:', DB_PATH);
  }
} else {
  // ─── PostgreSQL setup ───────────────────────────────────────────────────────
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const schema = await import('./schema.pg.js');

  const isProduction = process.env.NODE_ENV === 'production';

  const client = postgres(DATABASE_URL!, {
    max: isProduction ? 20 : 10,      // more connections in production
    idle_timeout: 30,                 // release idle connections after 30s
    connect_timeout: 10,              // fail fast if DB is unreachable
    prepare: true,                    // enable prepared statement caching
    retry: isProduction ? {           // retry transient failures in production
      attempts: 3,
      delay: (attempt: number) => Math.min(attempt * 500, 3000),
    } : undefined,
    onnotice: () => {},               // suppress NOTICE messages
  });

  // Verify connection on startup
  try {
    await client`SELECT 1`;
    db = drizzle(client, { schema });
    console.log('🐘 PostgreSQL verbunden (pool: ' + (isProduction ? 20 : 10) + ' max)');
  } catch (err: any) {
    console.error('🚨 PostgreSQL-Verbindung fehlgeschlagen:', err.message);
    if (isProduction) {
      console.error('🚨 Production start aborted — database unreachable.');
      process.exit(1);
    }
    throw err;
  }
}

export { db, sqlite };

// ─── Migration Runner ─────────────────────────────────────────────────────────
async function getMigrationsDir(): Promise<string> {
  return path.join(MIGRATIONS_DIR, isPg ? 'postgres' : 'sqlite');
}

async function runMigrations() {
  const migrationsDir = await getMigrationsDir();

  if (isPg) {
    await runPostgresMigrations(migrationsDir);
  } else {
    await runSqliteMigrations(migrationsDir);
  }
}

async function runSqliteMigrations(migrationsDir: string) {
  // Ensure _migrations tracking table exists
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set<string>(
    sqlite.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name)
  );

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    // Execute in a transaction
    const run = sqlite.transaction(() => {
      sqlite.exec(sql);
      sqlite.prepare(
        "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)"
      ).run(file, new Date().toISOString());
    });
    run();

    console.log(`✅ Migration angewendet: ${file}`);
    count++;
  }

  if (count === 0) {
    console.log('✅ Datenbank aktuell — keine neuen Migrationen');
  }
}

async function runPostgresMigrations(migrationsDir: string) {
  // Use the underlying postgres client directly for migrations
  const { default: postgres } = await import('postgres');
  const client = postgres(DATABASE_URL!, {
    max: 1, // single connection for migrations
    connect_timeout: 10,
  });

  try {
    // Ensure _migrations tracking table exists
    await client`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      )
    `;

    const applied = new Set<string>(
      (await client`SELECT name FROM _migrations`).map((r: any) => r.name)
    );

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.begin(async (tx) => {
        // Split by drizzle statement-breakpoint (handles statements with internal semicolons)
        const statements = sql
          .split('--> statement-breakpoint')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
          await tx.unsafe(stmt);
        }

        await tx.unsafe(
          `INSERT INTO _migrations (name, applied_at) VALUES ('${file.replace(/'/g, "''")}', '${new Date().toISOString()}')`
        );
      });

      console.log(`✅ Migration angewendet: ${file}`);
      count++;
    }

    if (count === 0) {
      console.log('✅ Datenbank aktuell — keine neuen Migrationen');
    }
  } finally {
    await client.end();
  }
}

// ─── Public init function ─────────────────────────────────────────────────────
export async function initializeDatabase() {
  await runMigrations();
}
