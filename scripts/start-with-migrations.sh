#!/bin/bash

# ===========================================
# Railway Start Script
# Runs migrations before starting the app
# ===========================================

set -e

echo "🚀 Starting deployment..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
sleep 5

# Run Prisma migrations
echo "📦 Running database migrations..."
bunx prisma migrate deploy || bunx prisma db push --accept-data-loss

# Generate Prisma client (in case it wasn't generated)
echo "🔧 Generating Prisma client..."
bunx prisma generate

# Start the application
echo "🌟 Starting application..."
exec bun run start
