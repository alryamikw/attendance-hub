// Railway environment variable fallback
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:siRYAWGEhdXEgAzUqKGUuukBMxEacZSh@postgres.railway.internal:5432/railway';
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = 'postgresql://postgres:siRYAWGEhdXEgAzUqKGUuukBMxEacZSh@postgres.railway.internal:5432/railway';
}
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db