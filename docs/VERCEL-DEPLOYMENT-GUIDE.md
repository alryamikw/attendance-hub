# 🚀 دليل النشر على Vercel المجاني

## نظرة سريعة

هذا الدليل يشرح كيفية نشر نظام الحضور على Vercel مع الخدمات المجانية المرتبطة.

---

## 📋 المتطلبات

- حساب GitHub
- حساب Vercel (مجاني)
- حساب Supabase (مجاني)
- حساب Pusher (مجاني)

---

## الخطوة 1: إعداد Supabase (قاعدة البيانات)

### 1.1 إنشاء حساب
1. اذهب إلى [supabase.com](https://supabase.com)
2. اضغط **Start your project**
3. سجل باستخدام GitHub

### 1.2 إنشاء مشروع
```
Name: attendance-hub
Database Password: [كلمة مرور قوية]
Region: أقرب منطقة لك
```

### 1.3 الحصول على Connection String
1. اذهب إلى **Project Settings** > **Database**
2. انسخ **Connection string** (URI format)
3. استبدل `[YOUR-PASSWORD]` بكلمة المرور

```
postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
```

---

## الخطوة 2: تعديل المشروع لـ PostgreSQL

### 2.1 تعديل prisma/schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"  // تغيير من sqlite إلى postgresql
  url      = env("DATABASE_URL")
}

// بقية الـ models تبقى كما هي...
```

### 2.2 إنشاء ملف .env.production

```env
# قاعدة البيانات
DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"

# المصادقة
NEXTAUTH_SECRET="your-super-secret-key-at-least-32-characters-long"
NEXTAUTH_URL="https://your-app.vercel.app"

# التطبيق
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
NEXT_PUBLIC_APP_NAME="AttendanceHub"

# Pusher (للـ Real-time)
NEXT_PUBLIC_PUSHER_KEY="your-pusher-key"
PUSHER_APP_ID="your-pusher-app-id"
PUSHER_SECRET="your-pusher-secret"
PUSHER_CLUSTER="us2"
```

### 2.3 تحديث الحزم

```bash
# حذف mini-services (غير مدعومة على Vercel)
rm -rf mini-services
```

---

## الخطوة 3: إعداد Pusher (Real-time)

### 3.1 إنشاء حساب
1. اذهب إلى [pusher.com](https://pusher.com)
2. اضغط **Sign up free**
3. أنشئ تطبيق جديد

### 3.2 الحصول على المفاتيح
```
App ID: 1234567
Key: abcdefghijklmnop
Secret: mnopqrstuvwxyz
Cluster: us2
```

### 3.3 إنشاء ملف Real-time جديد

```typescript
// src/lib/realtime-pusher.ts
import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server-side
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER || 'us2',
});

// Client-side
export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.PUSHER_CLUSTER || 'us2',
  }
);

// Helper functions
export async function broadcastAttendance(tenantId: string, data: any) {
  await pusherServer.trigger(`tenant-${tenantId}`, 'attendance-update', data);
}

export async function broadcastNotification(userId: string, data: any) {
  await pusherServer.trigger(`user-${userId}`, 'notification', data);
}
```

---

## الخطوة 4: النشر على Vercel

### 4.1 رفع المشروع على GitHub

```bash
# إنشاء مستودع جديد على GitHub
# ثم:

git init
git add .
git commit -m "Initial commit - Attendance SaaS"
git branch -M main
git remote add origin https://github.com/USERNAME/attendance-hub.git
git push -u origin main
```

### 4.2 ربط Vercel بـ GitHub

1. اذهب إلى [vercel.com](https://vercel.com)
2. اضغط **Sign up with GitHub**
3. اضغط **Import Project**
4. اختر المستودع `attendance-hub`

### 4.3 إعداد متغيرات البيئة

في صفحة إعداد المشروع، أضف المتغيرات:

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_PUSHER_KEY=...
PUSHER_APP_ID=...
PUSHER_SECRET=...
PUSHER_CLUSTER=us2
```

### 4.4 النشر

```bash
# أو استخدام Vercel CLI
npm i -g vercel
vercel login
vercel --prod
```

---

## الخطوة 5: إعداد قاعدة البيانات

### 5.1 تشغيل Migrations

```bash
# محلياً مع متغيرات الإنتاج
bunx prisma migrate deploy

# أو باستخدام Vercel CLI
vercel env pull .env.production
bunx prisma migrate deploy
```

### 5.2 إنشاء البيانات الأولية

```bash
# زيارة الرابط
https://your-app.vercel.app/api/setup
```

---

## الخطوة 6: اختبار التطبيق

### 6.1 التحقق من العمل

1. افتح `https://your-app.vercel.app`
2. تحقق من PWA:
   - على Chrome: اضغط أيقونة التثبيت في شريط العنوان
   - على Mobile: Add to Home Screen

### 6.2 اختبار الميزات

- [ ] تسجيل الدخول
- [ ] تسجيل الحضور
- [ ] طلب إجازة
- [ ] إضافة موظف
- [ ] عرض التقارير
- [ ] تصدير البيانات

---

## 🔧 حل المشاكل الشائعة

### مشكلة: Database connection failed
```
الحل: تأكد من صحة DATABASE_URL وإضافة DIRECT_URL
```

### مشكلة: Prisma Client not generated
```
الحل: أضف إلى package.json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

### مشكلة: WebSocket not working
```
الحل: تأكد من إعداد Pusher واستبدال Socket.io
```

### مشكلة: Environment variables not loading
```
الحل: أعد نشر المشروع بعد إضافة المتغيرات
vercel --prod
```

---

## 📊 حدود الخطة المجانية

| الخدمة | الحد | ما يحدث عند التجاوز |
|--------|------|---------------------|
| Vercel | 100GB bandwidth | يتوقف الموقع |
| Vercel | 100 serverless hours | يتوقف الموقع |
| Supabase | 500MB database | لا يمكن إضافة بيانات |
| Supabase | 5GB bandwidth | يتوقف الاتصال |
| Pusher | 200K messages/day | تتوقف الرسائل |

---

## 🔄 الترقية للإنتاج

عند الحاجة للترقية:

### Vercel Pro ($20/شهر)
- نطاق غير محدود
- وظائف أطول
- دعم فني

### Supabase Pro ($25/شهر)
- 8GB قاعدة بيانات
- 250GB bandwidth
- نسخ احتياطي يومي

### Pusher Starter ($49/شهر)
- 500,000 رسالة/يوم
- اتصالات أكثر

---

## ✅ ملخص سريع

```bash
# 1. إنشاء المشاريع
supabase.com → New Project
pusher.com → New App
vercel.com → Import from GitHub

# 2. إعداد المشروع
# تعديل schema.prisma: sqlite → postgresql
# إضافة .env.production

# 3. النشر
git push origin main
# Vercel سينشر تلقائياً

# 4. إعداد قاعدة البيانات
bunx prisma migrate deploy

# 5. اختبار
https://your-app.vercel.app/api/setup
https://your-app.vercel.app
```

---

🎉 **مبروك! نظام الحضور يعمل الآن على الإنترنت مجاناً!**
