import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.pg.ts',
  out: './server/db/migrations/postgres-generated',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/opencognit',
  },
});
