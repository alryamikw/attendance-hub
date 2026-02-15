# 🌍 نظام الحضور الجغرافي SaaS

نظام إدارة حضور متكامل متعدد المستأجرين مع دعم PWA والعمل بدون إنترنت.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-6-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## ✨ المميزات

### 🏢 إدارة المستأجرين (Multi-Tenant)
- نظام متعدد الشركات
- خطط اشتراك مرنة
- حدود للموظفين والفروع

### 📍 الموقع الجغرافي (Geofencing)
- تحديد نطاق العمل لكل فرع
- التحقق من الموقع عند تسجيل الحضور
- كشف محاولة التلاعب بالموقع

### 📱 PWA & Offline
- تطبيق ويب تقدمي قابل للتثبيت
- العمل بدون إنترنت
- مزامنة تلقائية عند الاتصال

### 👤 التعرف على الوجه
- تسجيل الوجه للموظفين
- التحقق عند تسجيل الحضور

### 💰 نظام الرواتب
- حساب تلقائي للرواتب
- خصومات التأخير والغياب
- إضافي العمل الإضافي

### 📊 التقارير
- تقارير الحضور اليومية/الشهرية
- تصدير PDF/Excel/CSV
- إحصائيات تفصيلية

---

## 🚀 البدء السريع

### المتطلبات
- Node.js 18+ أو Bun
- PostgreSQL (للإنتاج) أو SQLite (للتطوير)

### التثبيت

```bash
# استنساخ المشروع
git clone https://github.com/your-username/attendance-hub.git
cd attendance-hub

# تثبيت الحزم
bun install

# إعداد قاعدة البيانات
bun run db:push

# تشغيل التطبيق
bun run dev
```

افتح [http://localhost:3000](http://localhost:3000) في المتصفح.

### البيانات الأولية

```bash
# زيارة صفحة الإعداد
http://localhost:3000/api/setup
```

---

## 📖 الأدلة

| الدليل | الوصف |
|--------|-------|
| [دليل Railway](docs/RAILWAY-DEPLOYMENT-GUIDE.md) | النشر على Railway المجاني |
| [دليل Vercel](docs/VERCEL-DEPLOYMENT-GUIDE.md) | النشر على Vercel + Supabase |
| [تقرير المشروع](docs/PROJECT-REPORT.md) | تقرير شامل عن المشروع |
| [الميزات غير المكتملة](docs/INCOMPLETE-FEATURES.md) | ما يحتاج إكمال |

---

## 🏗️ هيكل المشروع

```
├── prisma/
│   └── schema.prisma        # قاعدة البيانات (30+ جدول)
├── src/
│   ├── app/
│   │   ├── page.tsx         # الصفحة الرئيسية (8 تبويبات)
│   │   ├── layout.tsx       # التخطيط العام
│   │   └── api/             # API Routes
│   ├── components/
│   │   ├── ui/              # مكونات shadcn/ui
│   │   └── ...              # مكونات مخصصة
│   └── lib/
│       ├── auth.ts          # المصادقة
│       ├── geofencing.ts    # الموقع الجغرافي
│       ├── attendance.ts    # محرك الحضور
│       ├── payroll.ts       # محرك الرواتب
│       └── ...              # مكتبات أخرى
├── public/
│   ├── manifest.json        # PWA Manifest
│   └── icons/               # أيقونات PWA
└── docs/                    # التوثيق
```

---

## 🔧 الأوامر المتاحة

```bash
# التطوير
bun run dev           # تشغيل الخادم المحلي

# قاعدة البيانات
bun run db:push       # إنشاء الجداول
bun run db:generate   # إنشاء Prisma Client
bun run db:migrate    # إنشاء migration

# الإنتاج
bun run build         # بناء التطبيق
bun run start         # تشغيل الإنتاج

# الفحص
bun run lint          # فحص الكود
```

---

## 🌐 النشر

### Railway (موصى به)

```bash
# 1. تثبيت Railway CLI
npm i -g @railway/cli

# 2. تسجيل الدخول
railway login

# 3. إنشاء مشروع
railway init

# 4. إضافة PostgreSQL
railway add --plugin postgresql

# 5. النشر
railway up
```

### Vercel + Supabase

راجع [دليل Vercel](docs/VERCEL-DEPLOYMENT-GUIDE.md)

---

## 📊 التقنيات المستخدمة

| الفئة | التقنية |
|-------|---------|
| **Framework** | Next.js 16 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | shadcn/ui |
| **Database** | Prisma + PostgreSQL/SQLite |
| **State** | Zustand |
| **Icons** | Lucide React |
| **Charts** | Recharts |

---

## 🔐 المصادقة الافتراضية

بعد تشغيل `/api/setup`:

| الدور | البريد | كلمة المرور |
|-------|--------|-------------|
| Admin | admin@example.com | admin123 |

---

## 📱 PWA

التطبيق قابل للتثبيت كتطبيق مستقل:

1. افتح التطبيق في Chrome
2. اضغط أيقونة التثبيت في شريط العنوان
3. أو من القائمة > "Install App"

---

## 🤝 المساهمة

```bash
# Fork المشروع
# إنشاء فرع جديد
git checkout -b feature/amazing-feature

# عمل التغييرات
git commit -m "Add amazing feature"

# رفع التغييرات
git push origin feature/amazing-feature

# فتح Pull Request
```

---

## 📄 الترخيص

MIT License - راجع ملف [LICENSE](LICENSE) للتفاصيل.

---

## 🆘 الدعم

- 📧 البريد: support@example.com
- 📖 التوثيق: [docs/](docs/)
- 🐛 البلاغات: [GitHub Issues](https://github.com/your-username/attendance-hub/issues)

---

## 🙏 شكر وتقدير

- [Next.js](https://nextjs.org/)
- [Prisma](https://prisma.io/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
