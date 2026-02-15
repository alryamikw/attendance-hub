# دليل نشر التطبيق على الاستضافة

## 🎯 خيارات النشر المتاحة

### الخيار 1: Vercel (الأفضل لـ Next.js) ⭐⭐⭐⭐⭐

**المميزات**:
- مجاني للمشاريع الصغيرة
- نشر تلقائي من GitHub
- CDN عالمي
- SSL مجاني
- دعم Next.js الأصلي

**الخطوات**:

```bash
# 1. تثبيت Vercel CLI
npm i -g vercel

# 2. تسجيل الدخول
vercel login

# 3. نشر المشروع
cd /home/z/my-project
vercel --prod
```

**أو عبر الموقع**:
1. اذهب إلى [vercel.com](https://vercel.com)
2. اربط حساب GitHub
3. اختر المشروع
4. أضف متغيرات البيئة
5. انشر!

---

### الخيار 2: Hostinger VPS ⭐⭐⭐⭐

**المميزات**:
- تحكم كامل في الخادم
- تكلفة معقولة ($3.99-$7.99/شهر)
- دعم Node.js
- SSL مجاني

#### الخطوات التفصيلية:

##### 1. شراء VPS من Hostinger

1. اذهب إلى [hostinger.com/vps-hosting](https://www.hostinger.com/vps-hosting)
2. اختر خطة VPS (KVM 1 أو أعلى)
3. اختر نظام التشغيل: **Ubuntu 22.04**

##### 2. الاتصال بالخادم

```bash
# من جهازك المحلي
ssh root@your-server-ip

# أو استخدم Terminal في لوحة تحكم Hostinger
```

##### 3. تحديث النظام وتثبيت المتطلبات

```bash
# تحديث النظام
apt update && apt upgrade -y

# تثبيت Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# تثبيت Bun (أسرع من npm)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# تثبيت PM2 لإدارة العمليات
npm install -g pm2

# تثبيت Nginx كـ Reverse Proxy
apt install -y nginx

# تثبيت SQLite
apt install -y sqlite3
```

##### 4. إعداد قاعدة البيانات

```bash
# إنشاء مجلد للتطبيق
mkdir -p /var/www/attendancehub
cd /var/www/attendancehub

# إنشاء مجلد للبيانات
mkdir -p data
```

##### 5. رفع ملفات المشروع

**الطريقة 1: من GitHub**
```bash
# استنساخ المشروع
git clone https://github.com/your-username/attendancehub.git .
```

**الطريقة 2: من جهازك المحلي (SCP)**
```bash
# من جهازك المحلي - ضغط الملفات أولاً
cd /home/z/my-project
tar -czvf ../attendancehub.tar.gz .

# رفع الملف المضغوط
scp ../attendancehub.tar.gz root@your-server-ip:/var/www/attendancehub/

# على الخادم - فك الضغط
cd /var/www/attendancehub
tar -xzvf attendancehub.tar.gz
```

##### 6. إعداد التطبيق

```bash
cd /var/www/attendancehub

# إنشاء ملف .env
cat > .env << 'EOF'
DATABASE_URL="file:./data/production.db"
NEXTAUTH_SECRET="your-super-secret-key-change-this"
NEXTAUTH_URL="https://yourdomain.com"
NODE_ENV="production"
EOF

# توليد سر عشوائي
openssl rand -base64 32 >> .env

# تثبيت التبعيات
bun install

# بناء قاعدة البيانات
bun run db:push

# بناء التطبيق (للإنتاج مع Docker أو standalone)
bun run build
```

##### 7. إعداد PM2

```bash
# إنشاء ملف تكوين PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'attendancehub',
      script: 'bun',
      args: 'run start',
      cwd: '/var/www/attendancehub',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'realtime-service',
      script: 'bun',
      args: 'run dev',
      cwd: '/var/www/attendancehub/mini-services/realtime-service',
      instances: 1,
      autorestart: true,
      env: {
        PORT: 3003
      }
    }
  ]
};
EOF

# بدء التطبيق
pm2 start ecosystem.config.js

# حفظ إعدادات PM2
pm2 save

# جعل PM2 يبدأ تلقائياً
pm2 startup
```

##### 8. إعداد Nginx

```bash
# إنشاء ملف تكوين Nginx
cat > /etc/nginx/sites-available/attendancehub << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # توجيه للمنفذ 3000
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket للمنفذ 3003
    location /socket.io/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# تفعيل الموقع
ln -s /etc/nginx/sites-available/attendancehub /etc/nginx/sites-enabled/

# اختبار التكوين
nginx -t

# إعادة تشغيل Nginx
systemctl restart nginx
```

##### 9. تثبيت SSL مجاني (Let's Encrypt)

```bash
# تثبيت Certbot
apt install -y certbot python3-certbot-nginx

# الحصول على شهادة SSL
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# التجديد التلقائي
certbot renew --dry-run
```

##### 10. إعداد الجدار الناري

```bash
# السماح بالمنافذ المطلوبة
ufw allow 22      # SSH
ufw allow 80      # HTTP
ufw allow 443     # HTTPS
ufw enable

# التحقق
ufw status
```

##### 11. النسخ الاحتياطي التلقائي

```bash
# إنشاء سكربت النسخ الاحتياطي
cat > /var/www/attendancehub/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/www/backups"
mkdir -p $BACKUP_DIR

# نسخ قاعدة البيانات
sqlite3 /var/www/attendancehub/prisma/production.db ".backup $BACKUP_DIR/db_$DATE.db"

# ضغط الملفات المهمة
tar -czvf $BACKUP_DIR/backup_$DATE.tar.gz /var/www/attendancehub/.env /var/www/attendancehub/prisma/

# حذف النسخ القديمة (أكثر من 7 أيام)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /var/www/attendancehub/backup.sh

# إضافة مهمة cron للنسخ اليومي
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/attendancehub/backup.sh >> /var/log/backup.log 2>&1") | crontab -
```

---

### الخيار 3: Docker + أي استضافة ⭐⭐⭐⭐

#### 1. إنشاء Dockerfile

```dockerfile
# Dockerfile
FROM oven/bun:1 AS base

# تثبيت التبعيات
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile

# بناء التطبيق
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run db:push
RUN bun run build

# التشغيل
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/mini-services ./mini-services

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["bun", "run", "start"]
```

#### 2. إنشاء docker-compose.yml

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "3003:3003"
    environment:
      - DATABASE_URL=file:./data/production.db
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
```

#### 3. النشر

```bash
# بناء وتشغيل
docker-compose up -d --build

# عرض السجلات
docker-compose logs -f
```

---

### الخيار 4: Railway.app ⭐⭐⭐⭐

**المميزات**:
- سهولة الاستخدام
- دعم Docker
- قاعدة بيانات مجانية
- نشر سريع

**الخطوات**:
1. اذهب إلى [railway.app](https://railway.app)
2. اربط GitHub
3. اختر المشروع
4. أضف متغيرات البيئة
5. انشر!

---

### الخيار 5: DigitalOcean App Platform ⭐⭐⭐⭐

**التكلفة**: $5/شهر

**الخطوات**:
1. اذهب إلى [digitalocean.com](https://digitalocean.com)
2. اختر App Platform
3. اربط GitHub
4. اختر المشروع
5. انشر!

---

## 📋 قائمة التحقق قبل النشر

### 1. الأمان
- [ ] تغيير NEXTAUTH_SECRET إلى قيمة عشوائية قوية
- [ ] التأكد من عدم وجود بيانات حساسة في الكود
- [ ] إعداد CORS بشكل صحيح
- [ ] تفعيل HTTPS

### 2. قاعدة البيانات
- [ ] نسخ احتياطي لقاعدة البيانات
- [ ] التأكد من صحة DATABASE_URL
- [ ] تشغيل migrations

### 3. الأداء
- [ ] تحسين الصور
- [ ] تفعيل ضغط Gzip
- [ ] إعداد CDN (اختياري)

### 4. المراقبة
- [ ] إعداد سجلات الأخطاء
- [ ] مراقبة الأداء
- [ ] تنبيهات تعطل الخادم

---

## 🔧 متغيرات البيئة المطلوبة

```env
# قاعدة البيانات
DATABASE_URL="file:./data/production.db"

# المصادقة
NEXTAUTH_SECRET="your-random-32-character-string"
NEXTAUTH_URL="https://yourdomain.com"

# البيئة
NODE_ENV="production"

# اختياري - الإشعارات
RESEND_API_KEY="re_xxxxx"

# اختياري - الفوترة
STRIPE_SECRET_KEY="sk_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"

# اختياري - Face Recognition
# (يستخدم z-ai-web-dev-sdk المدمج)
```

---

## 📞 الدعم

في حالة وجود مشاكل:
1. راجع سجلات PM2: `pm2 logs`
2. راجع سجلات Nginx: `tail -f /var/log/nginx/error.log`
3. تحقق من حالة الخدمات: `systemctl status nginx`

---

## 💰 مقارنة التكاليف الشهرية

| الاستضافة | التكلفة | المميزات |
|----------|---------|----------|
| Vercel (Free) | $0 | 100GB bandwidth, Auto SSL |
| Hostinger VPS | $3.99-$7.99 | تحكم كامل, SSL مجاني |
| Railway | $5 | سهل, قواعد بيانات |
| DigitalOcean | $5 | موثوق, دعم ممتاز |
| AWS | $10+ | قوي, معقد |

**التوصية**: ابدأ بـ **Vercel المجاني** للتجربة، ثم انتقل إلى **Hostinger VPS** للإنتاج.
