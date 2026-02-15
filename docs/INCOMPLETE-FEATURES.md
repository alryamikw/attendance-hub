# الميزات غير المكتملة والتحسينات المقترحة

## 🔴 ما لم يتم إنجازه بعد

### 1. نظام الإشعارات الفعلي (Email/SMS)
**الحالة**: الواجهة جاهزة، الخلفية غير مفعلة

**المطلوب**:
```typescript
// src/lib/notifications.ts - ملف جديد مطلوب
import { Resend } from 'resend'; // أو SendGrid

export async function sendEmail(to: string, subject: string, body: string) {
  // تكامل مع Resend أو SendGrid
}

export async function sendSMS(phone: string, message: string) {
  // تكامل مع Twilio أو SMS provider
}
```

**التكلفة التقديرية**:
- Resend: مجاني 3000 إيميل/شهر
- Twilio SMS: ~$0.0075/رسالة

---

### 2. نظام الفوترة (Billing/Subscription)
**الحالة**: قاعدة البيانات جاهزة، التكامل غير موجود

**المطلوب**:
```typescript
// src/lib/billing.ts - ملف جديد مطلوب
import Stripe from 'stripe';

export async function createSubscription(tenantId: string, planId: string) {
  // إنشاء اشتراك Stripe
}

export async function handleWebhook(event: Stripe.Event) {
  // معالجة webhooks من Stripe
}
```

**التكلفة**: Stripe 2.9% + $0.30 لكل معاملة

---

### 3. Face Recognition - واجهة المستخدم
**الحالة**: API جاهز، واجهة UI غير موجودة

**المطلوب**:
```tsx
// src/components/face-capture.tsx - مكون جديد
'use client';
import { useState, useRef } from 'react';

export function FaceCapture({ onCapture }: { onCapture: (image: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [capturing, setCapturing] = useState(false);
  
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    if (videoRef.current) videoRef.current.srcObject = stream;
  };
  
  const capture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current!.videoWidth;
    canvas.height = videoRef.current!.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current!, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg'));
  };
  
  return (
    <div>
      <video ref={videoRef} autoPlay playsInline />
      <Button onClick={capture}>Capture</Button>
    </div>
  );
}
```

---

### 4. نظام المصادقة الثنائية (2FA)
**الحالة**: غير موجود

**المطلوب**:
```typescript
// src/lib/two-factor.ts - ملف جديد
import { authenticator } from 'otplib';

export function generateSecret(email: string) {
  return authenticator.generateSecret();
}

export function verifyToken(secret: string, token: string) {
  return authenticator.verify({ token, secret });
}
```

---

### 5. Rate Limiting للحماية
**الحالة**: غير موجود

**المطلوب**:
```typescript
// src/middleware.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export async function middleware(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);
  if (!success) return new Response("Too many requests", { status: 429 });
}
```

---

### 6. نظام النسخ الاحتياطي التلقائي
**الحالة**: غير موجود

**المطلوب**:
```bash
# scripts/backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 prisma/dev.db ".backup backups/backup_$DATE.db"
# رفع إلى S3 أو Google Cloud Storage
```

---

### 7. API Documentation (Swagger/OpenAPI)
**الحالة**: غير موجود

**المطلوب**:
```typescript
// src/app/api/docs/route.ts
import { createSwaggerSpec } from 'next-swagger-doc';

export async function GET() {
  const spec = createSwaggerSpec({
    definition: {
      openapi: '3.0.0',
      info: { title: 'AttendanceHub API', version: '1.0' },
    },
  });
  return Response.json(spec);
}
```

---

## 🟡 التحسينات المقترحة

### 1. تحسين الأداء
```typescript
// إضافة React Query للتخزين المؤقت
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 دقائق
      cacheTime: 10 * 60 * 1000, // 10 دقائق
    },
  },
});
```

### 2. تحسين SEO
```tsx
// src/app/layout.tsx
export const metadata: Metadata = {
  title: 'AttendanceHub - نظام الحضور الذكي',
  description: 'نظام إدارة الحضور الجغرافي متعدد المستأجرين',
  keywords: ['attendance', 'geofencing', 'payroll', 'HR'],
  openGraph: {
    title: 'AttendanceHub',
    description: 'Smart Attendance System',
    images: ['/og-image.png'],
  },
};
```

### 3. تحسين إمكانية الوصول (Accessibility)
- إضافة aria-labels لجميع الأزرار
- تحسين التباين للألوان
- دعم قارئات الشاشة

### 4. تحسين الأمان
```typescript
// إضافة Content Security Policy
// next.config.js
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];
```

---

## 📊 جدول الأولويات

| الميزة | الأولوية | الجهد | التأثير |
|--------|---------|-------|---------|
| Email Notifications | عالية | متوسط | عالي |
| Billing (Stripe) | عالية | عالي | عالي |
| Face Recognition UI | متوسطة | متوسط | عالي |
| 2FA | متوسطة | متوسط | عالي |
| Rate Limiting | عالية | منخفض | عالي |
| Backup System | متوسطة | منخفض | متوسط |
| API Docs | منخفضة | منخفض | متوسط |

---

## 🛠️ الخطوات التالية المقترحة

### المرحلة 1 (1-2 أسبوع)
1. تفعيل الإشعالات البريدية (Resend)
2. إضافة Rate Limiting
3. نظام النسخ الاحتياطي

### المرحلة 2 (2-3 أسابيع)
1. تكامل Stripe للفوترة
2. واجهة Face Recognition
3. المصادقة الثنائية

### المرحلة 3 (1-2 أسبوع)
1. API Documentation
2. تحسين SEO
3. تحسين Accessibility
