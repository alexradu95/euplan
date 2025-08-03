# Deployment Guide

## Environment Setup

### Required Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="https://your-domain.com"

# Optional: Analytics, monitoring, etc.
```

### Recommended Production Values
```env
NODE_ENV=production
```

## Platform-Specific Deployment

### Vercel (Recommended)

1. **Connect Repository:**
   - Connect your Git repository to Vercel
   - Select the `apps/web` directory as the root

2. **Configure Environment:**
   ```bash
   # Add environment variables in Vercel dashboard
   DATABASE_URL=your_postgres_url
   NEXTAUTH_SECRET=your_secret
   NEXTAUTH_URL=https://your-domain.vercel.app
   ```

3. **Database Setup:**
   - Use Vercel Postgres or external PostgreSQL
   - Run migrations: `npx drizzle-kit push`

4. **Deploy:**
   - Push to main branch for automatic deployment

### Railway

1. **Create New Project:**
   ```bash
   railway login
   railway new
   ```

2. **Add PostgreSQL:**
   ```bash
   railway add postgresql
   ```

3. **Deploy:**
   ```bash
   railway up
   ```

4. **Configure Domain:**
   ```bash
   railway domain
   ```

### Docker (Self-Hosted)

**File:** `Dockerfile`
```dockerfile
FROM node:18-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

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

**File:** `docker-compose.yml`
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/euplan
      - NEXTAUTH_SECRET=your-secret
      - NEXTAUTH_URL=http://localhost:3000
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=euplan
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

## Database Migration

### Production Migration Process
```bash
# 1. Backup current database
pg_dump $DATABASE_URL > backup.sql

# 2. Run migrations
npx drizzle-kit push

# 3. Verify migration
psql $DATABASE_URL -c "\dt"
```

### Rollback Process
```bash
# If migration fails, restore from backup
psql $DATABASE_URL < backup.sql
```

## Performance Monitoring

### Recommended Tools
- **Vercel Analytics:** Built-in performance monitoring
- **Sentry:** Error tracking and performance monitoring
- **PostHog:** User analytics and feature flags

### Key Metrics to Monitor
- **Response Times:** API route performance
- **Error Rates:** Failed saves and authentication errors
- **User Engagement:** Document creation and editing patterns
- **Database Performance:** Query execution times

## Security Checklist

- [ ] HTTPS enabled (automatic with Vercel/Railway)
- [ ] Environment variables properly configured
- [ ] Database credentials secure
- [ ] NEXTAUTH_SECRET is strong and unique
- [ ] No sensitive data in git repository
- [ ] Database backups configured
- [ ] Rate limiting considered (if needed)

## Scaling Considerations

### Current Limits
- **Concurrent Users:** Next.js can handle thousands
- **Document Size:** Y.js supports large documents well
- **Database:** PostgreSQL scales to millions of documents

### When to Scale
- **High CPU Usage:** Consider upgrading instance
- **Database Slow:** Add indexes, consider read replicas
- **Many Users:** Consider CDN for static assets

### Future Scaling Options
- **CDN:** CloudFlare or Vercel Edge Network
- **Database:** Read replicas, connection pooling  
- **Caching:** Redis for frequently accessed documents
- **File Storage:** S3/R2 for document attachments
