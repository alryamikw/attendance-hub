# 🚀 دليل النشر التفصيلي على Railway

## ما هو Railway؟

Railway هي منصة سحابية تتيح لك نشر التطبيقات وقواعد البيانات بسهولة. الخطة المجانية تعطيك $5 رصيد شهريًا، وهو كافٍ لتشغيل مشروع صغير.

---

## 📋 المتطلبات

- حساب GitHub
- حساب Railway (يمكن التسجيل بـ GitHub)
- بطاقة ائتمان (للتحقق - لن يتم خصم شيء في الخطة المجانية)

---

## 🔧 الخطوة 1: تعديلات المشروع

### 1.1 تعديل قاعدة البيانات لـ PostgreSQL

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"  // تغيير من sqlite إلى postgresql
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// بقية الجداول تبقى كما هي...
```

### 1.2 تحديث package.json

```json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "prisma generate && next build",
    "start": "next start -p $PORT",
    "lint": "eslint .",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "postinstall": "prisma generate"
  }
}
```

### 1.3 إنشاء ملف railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "bun run start",
    "healthcheckPath": "/",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 1.4 إنشاء ملف nixpacks.toml

```toml
[phases.setup]
nixPkgs = ['...', 'bun']

[phases.install]
cmds = ['bun install']

[phases.build]
cmds = ['bun run build']

[start]
cmd = 'bun run start'
```

---

## 🌐 الخطوة 2: إنشاء مشروع Railway

### 2.1 التسجيل في Railway

1. اذهب إلى [railway.app](https://railway.app)
2. اضغط **Start a New Project**
3. سجل باستخدام GitHub
4. أضف بطاقة ائتمان للتحقق (لن يتم خصم شيء)

### 2.2 إنشاء مشروع جديد

1. اضغط **+ New Project**
2. اختر **Deploy from GitHub repo**
3. اختر مستودع المشروع
4. اضغط **Deploy Now**

---

## 💾 الخطوة 3: إضافة قاعدة البيانات

### 3.1 إضافة PostgreSQL

1. في صفحة المشروع، اضغط **+ Add Service**
2. اختر **Database** > **PostgreSQL**
3. Railway سينشئ قاعدة بيانات تلقائياً

### 3.2 الحصول على رابط الاتصال

1. اضغط على خدمة PostgreSQL
2. اذهب إلى تبويب **Variables**
3. انسخ قيمة `DATABASE_URL`

---

## ⚙️ الخطوة 4: إعداد متغيرات البيئة

### 4.1 إضافة المتغيرات للتطبيق

في صفحة التطبيق (Web Service)، اذهب إلى **Variables** وأضف:

```env
# قاعدة البيانات (تضاف تلقائياً عند ربط PostgreSQL)
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=${{Postgres.DATABASE_URL}}

# المصادقة
NEXTAUTH_SECRET=your-super-secret-key-at-least-32-characters-long
NEXTAUTH_URL=https://your-app.railway.app

# التطبيق
NEXT_PUBLIC_APP_URL=https://your-app.railway.app
NEXT_PUBLIC_APP_NAME=AttendanceHub

# البيئة
NODE_ENV=production
```

### 4.2 توليد NEXTAUTH_SECRET

```bash
# محلياً أو في Terminal
openssl rand -base64 32
```

---

## 🔄 الخطوة 5: ربط الخدمات

### 5.1 ربط قاعدة البيانات بالتطبيق

1. اذهب إلى **Project Settings**
2. اختر **Service Networking**
3. تأكد أن الخدمات متصلة

أو استخدام المتغيرات المرجعية:
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

---

## 🚀 الخطوة 6: النشر الأول

### 6.1 النشر اليدوي

```bash
# تثبيت Railway CLI
npm i -g @railway/cli

# تسجيل الدخول
railway login

# ربط المشروع
railway link

# النشر
railway up
```

### 6.2 النشر التلقائي (GitHub)

Railway سينشر تلقائياً عند كل push إلى الفرع الرئيسي.

---

## 🗃️ الخطوة 7: تشغيل Migrations

### 7.1 عبر Railway CLI

```bash
# الاتصال بالمشروع
railway link

# تشغيل migrations
railway run bunx prisma migrate deploy

# أو دفع المخطط
railway run bunx prisma db push
```

### 7.2 عبر Railway Dashboard

1. اذهب إلى التطبيق
2. اضغط **Settings** > **Build**
3. أضف في **Build Command**:
   ```
   bunx prisma generate && bun run build
```

---

## 🌍 الخطوة 8: إعداد النطاق المخصص (اختياري)

### 8.1 استخدام نطاق Railway

1. اذهب إلى **Settings** > **Networking**
2. اضغط **Generate Domain**
3. ستحصل على: `your-app.railway.app`

### 8.2 نطاق مخصص

1. اضغط **Add Custom Domain**
2. أدخل نطاقك (مثال: `app.yourcompany.com`)
3. أضف سجلات DNS المطلوبة

---

## 📊 الخطوة 9: المراقبة والتتبع

### 9.1 عرض السجلات

1. اذهب إلى التطبيق
2. اضغط تبويب **Deployments**
3. اختر أي deployment لعرض السجلات

### 9.2 مراقبة الموارد

1. اذهب إلى **Metrics** tab
2. راقب CPU, Memory, Network

---

## 🔧 الخطوة 10: إعداد WebSocket

### الطريقة 1: استخدام نفس الخدمة (موصى بها)

Next.js 16 يدعم WebSocket في نفس الخدمة:

```typescript
// src/app/api/socket/route.ts
import { Server } from 'socket.io';
import type { NextApiRequest } from 'next';

export default function handler(req: NextApiRequest, res: any) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server);
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      console.log('Client connected');
      
      socket.on('attendance-update', (data) => {
        io.emit('attendance-broadcast', data);
      });
    });
  }
  res.end();
}
```

### الطريقة 2: خدمة WebSocket منفصلة

```bash
# إنشاء خدمة جديدة في Railway
# 1. Add Service > GitHub Repo
# 2. اختر نفس المستودع
# 3. Root Directory: mini-services/realtime-service
# 4. Port: 3003
```

---

## 💰 تفاصيل التكلفة

### الخطة المجانية

| المورد | الحد |
|--------|------|
| **الرصيد الشهري** | $5 مجاناً |
| **ساعات الحوسبة** | ~500 ساعة |
| **PostgreSQL** | 1GB |
| **الذاكرة** | 512MB - 8GB |
| **النطاق** | 100GB |

### تقدير التكلفة

| الخدمة | التكلفة الشهرية |
|--------|-----------------|
| Web Service (512MB) | ~$1-2 |
| PostgreSQL (1GB) | ~$1 |
| WebSocket Service | ~$1-2 |
| **المجموع** | **$3-5/شهر** |

> ✅ **الخطة المجانية تكفي لتشغيل المشروع بالكامل!**

---

## 🔄 استكشاف الأخطاء

### خطأ: Database connection failed

```bash
# تحقق من المتغيرات
railway variables

# تأكد من صحة DATABASE_URL
echo $DATABASE_URL
```

### خطأ: Build failed

```bash
# تحقق من سجلات البناء
railway logs

# تأكد من وجود postinstall في package.json
npm pkg set scripts.postinstall="prisma generate"
```

### خطأ: Out of memory

```bash
# زيادة الذاكرة في Settings > Resources
# أو تحسين الكود
```

### خطأ: Cold start timeout

```bash
# تفعيل Always On في Settings
# أو استخدام Cron Job للإبقاء نشطاً
```

---

## ✅ قائمة التحقق قبل النشر

- [ ] تغيير `sqlite` إلى `postgresql` في schema.prisma
- [ ] إضافة `postinstall` script
- [ ] إعداد متغيرات البيئة
- [ ] ربط PostgreSQL بالتطبيق
- [ ] تشغيل `prisma migrate deploy`
- [ ] اختبار التطبيق

---

## 📱 أوامر Railway CLI المهمة

```bash
# تسجيل الدخول
railway login

# إنشاء مشروع جديد
railway init

# ربط مشروع موجود
railway link

# عرض المتغيرات
railway variables

# عرض السجلات
railway logs

# فتح Terminal
railway run bash

# تشغيل أمر
railway run bunx prisma migrate deploy

# النشر
railway up

# فتح الموقع
railway open
```

---

## 🎉 الخطوة الأخيرة: اختبار التطبيق

بعد النشر الناجح:

1. افتح `https://your-app.railway.app`
2. اذهب إلى `/api/setup` لإنشاء البيانات الأولية
3. سجل الدخول بالبيانات:
   - Email: `admin@example.com`
   - Password: `admin123`
4. اختبر جميع الميزات:
   - تسجيل الحضور
   - إضافة موظفين
   - طلب إجازة
   - عرض التقارير

---

## 🔗 روابط مفيدة

- [Railway Docs](https://docs.railway.app)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [Railway Pricing](https://railway.app/pricing)
- [Prisma PostgreSQL](https://prisma.io/docs/concepts/database-connectors/postgresql)

---

🎉 **مبروك! المشروع يعمل الآن على Railway!**
