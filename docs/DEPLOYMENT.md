# Deployment Architecture

## SaaS Geolocation Attendance System

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOAD BALANCER                             │
│                    (Nginx / CloudFlare)                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY / CADDY                          │
│                    (Port 443 / 80)                               │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   NEXT.JS     │     │   WEBSOCKET   │     │    STATIC     │
│    (3000)     │     │    (3003)     │     │    FILES      │
│               │     │               │     │               │
│  - SSR Pages  │     │  - Real-time  │     │  - Images     │
│  - API Routes │     │  - Sync       │     │  - Assets     │
│  - PWA        │     │  - Notifs     │     │  - Manifest   │
└───────────────┘     └───────────────┘     └───────────────┘
        │                       │
        └───────────────────────┼───────────────────────────────┐
                                │                               │
                                ▼                               ▼
                    ┌───────────────────┐           ┌───────────────────┐
                    │     DATABASE      │           │     REDIS         │
                    │   (PostgreSQL)    │           │    (Optional)     │
                    │                   │           │                   │
                    │  - Multi-tenant   │           │  - Sessions       │
                    │  - Attendance     │           │  - Cache          │
                    │  - Employees      │           │  - Queue          │
                    └───────────────────┘           └───────────────────┘
```

---

## Recommended Tech Stack for Production

### Option A: Cloud-Native (Recommended)

| Component | Technology | Provider |
|-----------|------------|----------|
| Hosting | Vercel / AWS | Vercel |
| Database | PostgreSQL | Supabase / Railway |
| Cache | Redis | Upstash |
| Storage | S3 | AWS S3 |
| CDN | CloudFlare | CloudFlare |
| Monitoring | Datadog / Sentry | Datadog |

### Option B: Self-Hosted

| Component | Technology | Notes |
|-----------|------------|-------|
| Hosting | Docker + Kubernetes | Scalable |
| Database | PostgreSQL 15 | Primary DB |
| Cache | Redis 7 | Session & Cache |
| Web Server | Caddy / Nginx | Reverse Proxy |
| Monitoring | Prometheus + Grafana | Metrics |

---

## Docker Configuration

### Dockerfile

```dockerfile
# Production Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN npm install -g bun && bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g bun && bun run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/attendance
      - NEXTAUTH_SECRET=your-secret-key
      - NEXTAUTH_URL=https://your-domain.com
    depends_on:
      - db
      - redis
    restart: unless-stopped

  websocket:
    build: ./mini-services/realtime-service
    ports:
      - "3003:3003"
    environment:
      - PORT=3003
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=attendance
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  caddy:
    image: caddy:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  caddy_data:
```

---

## Caddyfile Configuration

```caddyfile
# Caddyfile for production
{
  email your-email@example.com
}

your-domain.com {
  encode gzip
  
  # Main app
  handle /* {
    reverse_proxy app:3000 {
      header_up X-Real-IP {remote_host}
    }
  }
  
  # WebSocket
  handle /socket.io/* {
    reverse_proxy websocket:3003
  }
  
  # Static files caching
  handle /_next/static/* {
    reverse_proxy app:3000
    header Cache-Control "public, max-age=31536000, immutable"
  }
}
```

---

## Environment Variables

```bash
# .env.production

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/attendance"

# Authentication
NEXTAUTH_SECRET="your-super-secret-key-at-least-32-chars"
NEXTAUTH_URL="https://your-domain.com"

# App Configuration
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXT_PUBLIC_APP_NAME="AttendanceHub"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Storage
STORAGE_TYPE="s3" # or "local"
S3_BUCKET="your-bucket"
S3_REGION="us-east-1"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"

# Email (optional)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="noreply@example.com"
SMTP_PASS="your-smtp-password"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
```

---

## Kubernetes Deployment

### deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: attendance-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: attendance
  template:
    metadata:
      labels:
        app: attendance
    spec:
      containers:
        - name: app
          image: your-registry/attendance-app:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: attendance-secrets
                  key: database-url
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: attendance-service
spec:
  selector:
    app: attendance
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

---

## CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install Bun
        uses: oven-sh/setup-bun@v1
        
      - name: Install dependencies
        run: bun install
        
      - name: Run tests
        run: bun test
        
      - name: Build
        run: bun run build
        
      - name: Deploy to Production
        run: |
          # Add your deployment commands here
          echo "Deploying to production..."
```

---

## Monitoring & Logging

### Health Check Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
}
```

### Recommended Monitoring Tools

| Tool | Purpose |
|------|---------|
| Sentry | Error tracking |
| Datadog | APM & Metrics |
| LogDNA | Log aggregation |
| UptimeRobot | Uptime monitoring |
| Grafana | Dashboards |

---

## Security Checklist

- [ ] Enable HTTPS everywhere
- [ ] Set secure cookie flags
- [ ] Implement rate limiting
- [ ] Use CORS properly
- [ ] Enable CSP headers
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Enable WAF (Web Application Firewall)
- [ ] Implement IP allowlisting for admin
- [ ] Regular backup schedule

---

## Scaling Considerations

### Horizontal Scaling
- Use Kubernetes HPA for auto-scaling
- Implement session affinity for WebSocket
- Use Redis for shared session storage

### Database Scaling
- Read replicas for reporting queries
- Connection pooling with PgBouncer
- Partitioning for large tenants

### Performance Optimization
- CDN for static assets
- Edge caching with CloudFlare
- Database query optimization
- Implement caching strategies
