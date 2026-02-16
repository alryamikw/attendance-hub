# ===========================================
# Dockerfile for Railway - Node.js Version
# ===========================================

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci || npm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV DATABASE_URL=postgresql://postgres:siRYAWGEhdXEgAzUqKGUuukBMxEacZSh@postgres.railway.internal:5432/railway
ENV DIRECT_URL=postgresql://postgres:siRYAWGEhdXEgAzUqKGUuukBMxEacZSh@postgres.railway.internal:5432/railway
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 8080

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node server.js"]