# ===========================================
# Dockerfile for Railway - Version 7
# ===========================================

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci || npm install

FROM base AS builder
ENV DATABASE_URL=postgresql://postgres:siRYAWGEhdXEgAzUqKGUuukBMxEacZSh@nozomi.proxy.rlwy.net:19955/railway
ENV DIRECT_URL=postgresql://postgres:siRYAWGEhdXEgAzUqKGUuukBMxEacZSh@nozomi.proxy.rlwy.net:19955/railway

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV DATABASE_URL=postgresql://postgres:siRYAWGEhdXEgAzUqKGUuukBMxEacZSh@nozomi.proxy.rlwy.net:19955/railway
ENV DIRECT_URL=postgresql://postgres:siRYAWGEhdXEgAzUqKGUuukBMxEacZSh@nozomi.proxy.rlwy.net:19955/railway
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

# Copy node_modules with prisma
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 8080

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node server.js"]