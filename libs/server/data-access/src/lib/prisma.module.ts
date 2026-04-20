import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function isPostgresUrl(value: string): boolean {
  return value.startsWith('postgresql://') || value.startsWith('postgres://');
}

function fallbackPostgresUrl(): string {
  const host = process.env['DATABASE_HOST'] ?? 'localhost';
  const port = process.env['DATABASE_PORT'] ?? '5432';
  const user = process.env['DATABASE_USER'] ?? 'nxuser';
  const password = process.env['DATABASE_PASS'] ?? 'nxpass';
  const database = process.env['DATABASE_NAME'] ?? 'nxdb';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function resolveConnectionString(): string {
  const configuredUrl = process.env['DATABASE_URL'];

  if (configuredUrl && isPostgresUrl(configuredUrl)) {
    return configuredUrl;
  }

  if (configuredUrl?.startsWith('prisma+postgres://')) {
    // prisma+postgres URLs are tied to Prisma Postgres dev tunnels (localhost:51xxx)
    // and often fail in local API runtime. Fall back to explicit DB host settings.
    return fallbackPostgresUrl();
  }

  if (configuredUrl) {
    return configuredUrl;
  }

  return fallbackPostgresUrl();
}

const connectionString = resolveConnectionString();
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
