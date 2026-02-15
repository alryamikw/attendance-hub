# 🚀 دليل النشر السريع على Railway

## 📋 الخطوات المختصرة

### 1. إعداد المشروع (محلياً)

```bash
# تغيير قاعدة البيانات إلى PostgreSQL
# افتح prisma/schema.prisma وغيّر:
# provider = "sqlite"  إلى  provider = "postgresql"
# وأضف: directUrl = env("DIRECT_URL")
```

### 2. رفع على GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/attendance-hub.git
git push -u origin main
```

### 3. إنشاء مشروع Railway

```bash
# تثبيت Railway CLI
npm i -g @railway/cli

# تسجيل الدخول
railway login

# إنشاء مشروع جديد
railway init
```

### 4. إضافة PostgreSQL

```bash
# إضافة قاعدة البيانات
railway add --plugin postgresql

# أو من الـ Dashboard:
# Project Settings > Add Service > Database > PostgreSQL
```

### 5. إعداد متغيرات البيئة

من Railway Dashboard أو CLI:

```bash
railway variables set NEXTAUTH_SECRET="$(openssl rand -base64 32)"
railway variables set NEXTAUTH_URL="https://your-app.railway.app"
railway variables set NEXT_PUBLIC_APP_URL="https://your-app.railway.app"
railway variables set NODE_ENV="production"
```

### 6. النشر

```bash
# النشر
railway up

# أو ربط بـ GitHub للنشر التلقائي
# من Dashboard: Deploy from GitHub repo
```

### 7. تشغيل Migrations

```bash
# الاتصال بالمشروع
railway link

# تشغيل migrations
railway run bunx prisma migrate deploy
```

### 8. إنشاء البيانات الأولية

```bash
# زيارة الرابط
https://your-app.railway.app/api/setup
```

---

## 🎯 أوامر Railway السريعة

| الأمر | الوصف |
|-------|-------|
| `railway login` | تسجيل الدخول |
| `railway init` | إنشاء مشروع |
| `railway up` | النشر |
| `railway logs` | عرض السجلات |
| `railway variables` | عرض المتغيرات |
| `railway open` | فتح الموقع |
| `railway status` | حالة المشروع |

---

## 💡 نصائح مهمة

### توفير المال (الخطة المجانية)

```bash
# 1. إيقاف الخدمات غير المستخدمة
railway service stop

# 2. تقليل الذاكرة
# في Settings > Resources > Set memory limit

# 3. استخدام Cron Jobs بدلاً من Always On
# لإبقاء التطبيق نشطاً
```

### المراقبة

```bash
# عرض السجلات الحية
railway logs -f

# عرض المقاييس
# من Dashboard > Metrics
```

---

## ⚠️ حل المشاكل

### خطأ: Database connection failed

```bash
# تأكد من المتغيرات
railway variables

# أضف DATABASE_URL يدوياً
railway variables set DATABASE_URL="${{Postgres.DATABASE_URL}}"
```

### خطأ: Build failed

```bash
# تحقق من السجلات
railway logs

# تأكد من package.json
# يجب أن يحتوي على:
# "postinstall": "prisma generate"
```

### خطأ: Prisma Client not found

```bash
# أضف للمتغيرات
railway variables set PRISMA_CLI_BINARY_TARGETS="native,rhel-openssl-1.0.x"
```

---

## 📊 التكلفة التقديرية

| الخدمة | التكلفة الشهرية |
|--------|-----------------|
| Web Service | ~$1-2 |
| PostgreSQL | ~$1 |
| **المجموع** | **$2-3** |

> ✅ **الخطة المجانية ($5 شهرياً) تكفي للمشروع!**

---

🎉 **مبروك! المشروع يعمل الآن على Railway!**

---

## 🔗 روابط مفيدة

- [Railway Dashboard](https://railway.app/dashboard)
- [Railway Docs](https://docs.railway.app)
- [Prisma PostgreSQL](https://prisma.io/docs/concepts/database-connectors/postgresql)
