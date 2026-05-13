# خطة تطوير نظام RM DATA — الرداء الموحد

> **الإصدار**: 2.0 (محدّث 14 مارس 2026)
> هذا المستند يمثّل خارطة طريق مُعتمَدة مقسّمة إلى مرحلتين واضحتين، مبنية على متطلبات محددة وبنية تحتية حقيقية.

---

## فهرس المحتويات

- [الوضع الحالي](#الوضع-الحالي)
- [المرحلة الأولى (V1) — التركيز الحالي](#المرحلة-الأولى-v1--التركيز-الحالي)
  - [V1.1 التكامل السحابي عبر Hostinger](#v11-التكامل-السحابي-عبر-hostinger)
  - [V1.2 هوية مستخدم-موظف موحدة](#v12-هوية-مستخدم-موظف-موحدة)
  - [V1.3 صفحة حول النظام والتحديثات](#v13-صفحة-حول-النظام-والتحديثات)
- [المرحلة الثانية (V2) — الرؤية المستقبلية](#المرحلة-الثانية-v2--الرؤية-المستقبلية)
  - [V2.1 تقارير المبيعات والأفرع](#v21-تقارير-المبيعات-والأفرع)
  - [V2.2 بوابة إدارة الفرع](#v22-بوابة-إدارة-الفرع)
  - [V2.3 الخدمة الذاتية للموظفين والملّاك](#v23-الخدمة-الذاتية-للموظفين-والملاك)
- [الجدول الزمني](#الجدول-الزمني)

---

## الوضع الحالي

| الطبقة | التقنية الحالية |
|--------|----------------|
| سطح المكتب | Electron 28 |
| الواجهة | React 18 + Vite 5 + Tailwind CSS |
| إدارة الحالة | Zustand (مع persist) |
| قاعدة البيانات | SQLite3 محلي (TypeORM) |
| المصادقة | bcryptjs (تسجيل دخول محلي) |
| المستندات | نظام ملفات محلي (`userData/documents/`) |
| التحديثات | لا يوجد (تثبيت يدوي NSIS) |
| اللغة | عربي/إنجليزي (i18next) |
| الاستضافة المتاحة | **Hostinger** — نطاق فرعي: `rmdata.alredaa-almuwahad.com` |

### القيود الحالية الحرجة

- **قاعدة بيانات محلية فقط**: كل جهاز بنسخة مستقلة — لا مزامنة بين الأفرع
- **لا ربط بين المستخدم والموظف**: جدول `users` منفصل تماماً عن `employees`
- **لا تحديثات تلقائية**: كل تحديث يتطلب تثبيت يدوي على كل جهاز
- **لا صفحة "حول النظام"**: لا يوجد مكان لعرض الإصدار أو التحقق من التحديثات

---

# المرحلة الأولى (V1) — التركيز الحالي

> **الهدف**: تحويل النظام من تطبيق محلي معزول إلى تطبيق متصل سحابياً مع هوية موحدة ونظام تحديثات.

---

## V1.1 التكامل السحابي عبر Hostinger

### المشكلة

حالياً كل فرع يعمل بقاعدة بيانات SQLite مستقلة. البيانات محبوسة في جهاز واحد. لا يمكن لأي فرع رؤية بيانات فرع آخر.

### الحل المُعتمَد: API Middleware على `rmdata.alredaa-almuwahad.com`

النطاق الفرعي `rmdata.alredaa-almuwahad.com` سيكون **الجسر الآمن** بين تطبيقات Electron في الأفرع وقاعدة البيانات المركزية MySQL على Hostinger.

### البنية المعمارية

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   فرع دبي       │     │   فرع الشارقة    │     │   فرع عجمان     │
│   (Electron)     │     │   (Electron)     │     │   (Electron)     │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                       │                         │
         │          HTTPS + JWT (مشفّر)                    │
         ▼                       ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│         rmdata.alredaa-almuwahad.com                             │
│         ══════════════════════════════                            │
│         API Middleware (خادم وسيط آمن)                           │
│         Node.js + Express + Prisma                               │
│                                                                  │
│    ┌────────────┐  ┌─────────────┐  ┌───────────────────────┐   │
│    │ مصادقة JWT │  │ Rate Limit  │  │ صلاحيات RBAC          │   │
│    │ + Refresh  │  │ حماية من    │  │ (نفس أدوار النظام     │   │
│    │ Tokens     │  │ الإغراق     │  │  Admin/Manager/Staff)  │   │
│    └────────────┘  └─────────────┘  └───────────────────────┘   │
│                                                                  │
│    ┌────────────────────────────────────────────────────────┐   │
│    │ طبقة التحقق (Validation Layer)                         │   │
│    │ • لا يمرّر SQL خام — فقط endpoints محددة              │   │
│    │ • كل طلب يُسجَّل في audit_log                         │   │
│    │ • تحقق من الصلاحيات قبل كل عملية                      │   │
│    └────────────────────────────────────────────────────────┘   │
│                                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │    Hostinger MySQL            │
              │    (قاعدة بيانات مركزية)      │
              │                              │
              │    نفس الهيكل الحالي مع      │
              │    تعديلات للمزامنة          │
              └──────────────────────────────┘
```

### كيف يعمل النطاق الفرعي كجسر؟

#### الخطوة 1: إعداد Hostinger

Hostinger يدعم Node.js عبر:
- **الخيار A**: Node.js Hosting (إذا متاح في خطتك) — تشغيل Express مباشرة
- **الخيار B**: استخدام cPanel + Node.js Application Manager — تشغيل تطبيق Node.js عبر Passenger

الإعداد:
```
النطاق الفرعي:  rmdata.alredaa-almuwahad.com
المجلد:         /home/user/rmdata-api/
النقطة:         Node.js Application → port 3001 (داخلي)
SSL:            Let's Encrypt (مجاني من Hostinger) → HTTPS إلزامي
```

#### الخطوة 2: هيكل مشروع API Server

```
rmdata-api/
├── src/
│   ├── index.ts                 # نقطة البداية
│   ├── config/
│   │   ├── database.ts          # اتصال MySQL
│   │   └── cors.ts              # السماح فقط لتطبيقات Electron
│   ├── middleware/
│   │   ├── auth.ts              # JWT verification
│   │   ├── rateLimiter.ts       # حماية من الإغراق
│   │   ├── rbac.ts              # صلاحيات حسب الدور
│   │   └── audit.ts             # تسجيل كل عملية
│   ├── routes/
│   │   ├── auth.routes.ts       # POST /auth/login, /auth/refresh
│   │   ├── employees.routes.ts  # CRUD /employees
│   │   ├── branches.routes.ts   # CRUD /branches
│   │   ├── employers.routes.ts  # CRUD /employers
│   │   ├── documents.routes.ts  # CRUD /documents
│   │   ├── housing.routes.ts    # CRUD /housing
│   │   ├── vehicles.routes.ts   # CRUD /vehicles
│   │   ├── phones.routes.ts     # CRUD /phones
│   │   ├── entities.routes.ts   # CRUD /entities
│   │   └── settings.routes.ts   # GET/PUT /settings
│   ├── services/                # منطق الأعمال
│   └── prisma/
│       └── schema.prisma        # تعريف الجداول
├── prisma/
│   └── migrations/              # ترحيلات قاعدة البيانات
├── package.json
├── tsconfig.json
└── .env                         # متغيرات البيئة (لا تُرفع لـ Git)
```

#### الخطوة 3: تدفق الاتصال (مثال: جلب قائمة الموظفين)

```
Electron App (فرع دبي)                        rmdata.alredaa-almuwahad.com
═══════════════════════                        ═══════════════════════════

1. المستخدم يفتح صفحة الموظفين
   │
2. GET https://rmdata.alredaa-almuwahad.com/api/employees
   Headers: { Authorization: "Bearer eyJhbG..." }
   │                                            │
   │                                     3. JWT Middleware
   │                                        ├─ فك التوقيع
   │                                        ├─ التحقق من الصلاحية
   │                                        └─ استخراج userId, roleId
   │                                            │
   │                                     4. RBAC Middleware
   │                                        ├─ الدور: Manager
   │                                        ├─ الصلاحية: employees.view ✅
   │                                        └─ تمرير
   │                                            │
   │                                     5. employees.service
   │                                        ├─ Prisma: findMany()
   │                                        ├─ MySQL Query
   │                                        └─ إرجاع النتائج
   │                                            │
   ◄────────────────────────────────────────────┘
6. Response: { success: true, data: [...] }
   │
7. عرض القائمة في الواجهة
```

#### الخطوة 4: كود API الأساسي

```typescript
// src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

// أمان أساسي
app.use(helmet());
app.use(cors({
  origin: [
    'app://.',                              // Electron production
    'http://localhost:5173',                // Vite dev
  ],
  credentials: true,
}));

// حماية من الإغراق: 100 طلب لكل 15 دقيقة لكل IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use(express.json({ limit: '10mb' }));

// المسارات
app.use('/api/auth',      authRoutes);
app.use('/api/employees',  protect, employeesRoutes);
app.use('/api/branches',   protect, branchesRoutes);
app.use('/api/employers',  protect, employersRoutes);
// ... باقي المسارات

app.listen(process.env.PORT || 3001);
```

```typescript
// src/routes/employees.routes.ts
import { Router } from 'express';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// GET /api/employees — جلب القائمة
router.get('/', requirePermission('employees', 'view'), async (req, res) => {
  const { branchId, status, search } = req.query;
  const employees = await prisma.employee.findMany({
    where: {
      ...(branchId && { workBranchId: Number(branchId) }),
      ...(status && { status: String(status) }),
      ...(search && { name: { contains: String(search) } }),
      status: { not: 'archived' },
    },
    include: {
      workBranch: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: employees });
});

// GET /api/employees/:id — تفاصيل موظف
router.get('/:id', requirePermission('employees', 'view'), async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      workBranch: true,
      contractBranch: true,
      documents: { where: { isArchived: false } },
    },
  });
  if (!employee) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: employee });
});

// POST /api/employees — إضافة موظف
router.post('/', requirePermission('employees', 'create'), async (req, res) => {
  const employee = await prisma.employee.create({ data: req.body });
  await auditLog('employees', employee.id, 'INSERT', req.user.id, null, req.body);
  res.status(201).json({ success: true, data: employee });
});

// PUT /api/employees/:id — تعديل
router.put('/:id', requirePermission('employees', 'edit'), async (req, res) => {
  const old = await prisma.employee.findUnique({ where: { id: Number(req.params.id) } });
  const updated = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: req.body,
  });
  await auditLog('employees', updated.id, 'UPDATE', req.user.id, old, req.body);
  res.json({ success: true, data: updated });
});

export default router;
```

#### الخطوة 5: تعديل Electron Client (طبقة ApiAdapter)

```typescript
// src/services/cloudClient.ts
const API_BASE = 'https://rmdata.alredaa-almuwahad.com/api';

class CloudClient {
  private token: string | null = null;
  private refreshToken: string | null = null;

  async login(username: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      this.token = data.accessToken;
      this.refreshToken = data.refreshToken;
    }
    return data;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // إذا انتهت صلاحية التوكن → تجديد تلقائي
    if (res.status === 401 && this.refreshToken) {
      await this.refreshAccessToken();
      return this.request(method, path, body); // إعادة المحاولة
    }

    return res.json();
  }

  // اختصارات
  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body: unknown) { return this.request<T>('POST', path, body); }
  put<T>(path: string, body: unknown) { return this.request<T>('PUT', path, body); }
  del<T>(path: string) { return this.request<T>('DELETE', path); }
}

export const cloud = new CloudClient();
```

```typescript
// src/services/apiAdapter.ts
import { cloud } from './cloudClient';

type Mode = 'local' | 'cloud';

class ApiAdapter {
  mode: Mode = 'local'; // يبدأ محلي حتى يتم الإعداد

  // ═══ الموظفون ═══
  async getEmployees(filters?: Record<string, string>) {
    if (this.mode === 'local') {
      return window.electronAPI.dbQuery(EMPLOYEES_QUERY, []);
    }
    const params = new URLSearchParams(filters);
    return cloud.get(`/employees?${params}`);
  }

  async getEmployee(id: number) {
    if (this.mode === 'local') {
      return window.electronAPI.dbQuery(EMPLOYEE_DETAIL_QUERY, [id]);
    }
    return cloud.get(`/employees/${id}`);
  }

  async createEmployee(data: EmployeeInput) {
    if (this.mode === 'local') {
      return window.electronAPI.dbQuery(INSERT_EMPLOYEE_SQL, [...values]);
    }
    return cloud.post('/employees', data);
  }

  // ═══ نفس النمط لكل الكيانات ═══
  // branches, employers, vehicles, phones, housing, entities, documents...
}

export const api = new ApiAdapter();
```

### هيكلية البيانات — MySQL على Hostinger

```sql
-- ════════════════════════════════════════════════════════════
-- ترحيل الجداول الحالية من SQLite إلى MySQL
-- مع إضافة حقول المزامنة
-- ════════════════════════════════════════════════════════════

-- تعديلات على كل الجداول الرئيسية:
-- 1. UUID لتجنب تعارض auto-increment بين الأفرع
-- 2. branchOriginId لمعرفة أي فرع أنشأ السجل
-- 3. lastModifiedAt + syncVersion للمزامنة

-- جدول التدقيق المركزي (جديد)
CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id INT NOT NULL,
  action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  changed_by_user_id INT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_data JSON,
  new_data JSON,
  branch_id INT,
  ip_address VARCHAR(50),
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB;

-- جدول الجلسات (JWT refresh tokens)
CREATE TABLE user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  device_info TEXT,
  branch_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_revoked TINYINT(1) DEFAULT 0,
  INDEX idx_user (user_id),
  INDEX idx_token (refresh_token_hash)
) ENGINE=InnoDB;
```

### لماذا API وسيط وليس اتصال MySQL مباشر من Electron؟

| المعيار | اتصال مباشر بـ MySQL | API Middleware (الحل المعتمد) |
|---------|----------------------|------------------------------|
| **الأمان** | كارثي — بيانات MySQL (host, user, pass) مكشوفة داخل Electron (يمكن استخراجها) | آمن — Electron يعرف فقط عنوان API + JWT مؤقت |
| **الصلاحيات** | أي استعلام SQL ممكن — حذف جداول كاملة | كل endpoint محمي بصلاحيات RBAC |
| **المرونة** | مربوط بـ MySQL Hostinger فقط | غداً يمكن الانتقال لـ PostgreSQL دون تعديل Electron |
| **التدقيق** | مستحيل تتبع من فعل ماذا | كل عملية مسجلة تلقائياً في `audit_log` |
| **الأداء** | كل استعلام يمر عبر الإنترنت | الخادم يجمع البيانات ويرسل استجابة واحدة |

### استراتيجية الانتقال التدريجي

```
المرحلة A — الجسر (أسبوعين):
├── بناء API Server مع endpoints أساسية
├── نشره على rmdata.alredaa-almuwahad.com
├── إضافة ApiAdapter في Electron مع mode: 'local' | 'cloud'
└── اختبار مع فرع واحد

المرحلة B — الترحيل (أسبوعين):
├── ترحيل بيانات SQLite → MySQL (سكريبت تلقائي)
├── تفعيل Cloud Mode في فرع واحد (تجربة)
├── مراقبة الأداء والأخطاء
└── إصلاح المشاكل

المرحلة C — التعميم (أسبوع):
├── تفعيل Cloud Mode في جميع الأفرع
├── إبقاء SQLite كنسخة احتياطية محلية (Offline Fallback)
└── مراقبة مستمرة
```

### تجربة المستخدم

- **مؤشر اتصال** في الشريط العلوي: 🟢 متصل | 🟡 جاري المزامنة | 🔴 غير متصل (وضع محلي)
- **شفافية كاملة**: المستخدم يعمل بنفس الطريقة — لا يلاحظ الفرق
- **Offline Fallback**: إذا انقطع الإنترنت ← التطبيق يتحول تلقائياً للوضع المحلي ← عند العودة يُزامن

---

## V1.2 هوية مستخدم-موظف موحدة

### المشكلة الحالية

| جدول `users` | جدول `employees` |
|---|---|
| id, username, passwordHash | id, code, name |
| fullName, email | email, phone |
| roleId, isActive | status, workBranchId |
| **لا يوجد أي ربط بينهما** | **لا يوجد أي ربط بينهما** |

### الحل المُعتمَد: نوعان من المستخدمين

عند إضافة مستخدم جديد، المدير يختار:

```
┌──────────────────────────────────────────────────────────┐
│                   إضافة مستخدم جديد                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  نوع المستخدم:                                          │
│                                                          │
│  ┌─────────────────────┐  ┌────────────────────────────┐ │
│  │                     │  │                            │ │
│  │  👤 مستخدم حر       │  │  🔗 مستخدم مرتبط بموظف   │ │
│  │                     │  │                            │ │
│  │  حساب مستقل غير    │  │  مرتبط بسجل موظف أو      │ │
│  │  مرتبط بأي سجل     │  │  صاحب عمل في النظام      │ │
│  │  موظف/صاحب عمل     │  │                            │ │
│  │                     │  │  • الصورة والاسم من سجل   │ │
│  │  مثال: مدير عام     │  │    الموظف/صاحب العمل      │ │
│  │  أو مسؤول تقني      │  │  • تغيير كلمة مرور إلزامي │ │
│  │                     │  │    عند أول دخول            │ │
│  │  [اختيار]           │  │  [اختيار]                  │ │
│  └─────────────────────┘  └────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### عند اختيار "مستخدم مرتبط بموظف":

```
┌──────────────────────────────────────────────────────────┐
│           ربط المستخدم بموظف / صاحب عمل                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  🔍 بحث: [أحمد_________________]                        │
│                                                          │
│  النتائج (لا يملكون حساباً بعد):                         │
│                                                          │
│  ┌────┬──────────────┬──────────┬──────────┬───────────┐ │
│  │    │ الاسم         │ الكود    │ الفرع    │ النوع     │ │
│  ├────┼──────────────┼──────────┼──────────┼───────────┤ │
│  │ ○  │ أحمد رزق     │ RME-003  │ دبي     │ موظف      │ │
│  │ ○  │ أحمد محمد    │ RME-015  │ الشارقة │ موظف      │ │
│  │ ○  │ أحمد سالم    │ RMO-002  │ —       │ صاحب عمل  │ │
│  └────┴──────────────┴──────────┴──────────┴───────────┘ │
│                                                          │
│  ═════════════════════════════════════════════════════   │
│                                                          │
│  عند الربط يتم تلقائياً:                                │
│  • اسم المستخدم = الكود (مثلاً RME-003)                │
│  • الاسم الكامل = اسم الموظف                            │
│  • كلمة مرور مؤقتة = آخر 6 أرقام من رقم الهوية          │
│    أو كلمة مرور يحددها المدير                            │
│  • عند أول تسجيل دخول ← إجبار تغيير كلمة المرور        │
│                                                          │
│  [إلغاء]                              [إنشاء الحساب]    │
└──────────────────────────────────────────────────────────┘
```

### هيكلية البيانات — التعديلات المطلوبة

```sql
-- ═══ تعديل جدول users ═══

-- نوع المستخدم: حر أو مرتبط
ALTER TABLE users ADD COLUMN userType TEXT DEFAULT 'free'
  CHECK (userType IN ('free', 'linked'));

-- ربط بموظف (اختياري — فقط للمرتبطين)
ALTER TABLE users ADD COLUMN linkedEntityId INTEGER;

-- نوع الكيان المرتبط: موظف أو صاحب عمل
ALTER TABLE users ADD COLUMN linkedEntityType TEXT
  CHECK (linkedEntityType IN ('employee', 'employer'));

-- هل يحتاج تغيير كلمة المرور؟ (true عند الإنشاء)
ALTER TABLE users ADD COLUMN mustChangePassword INTEGER DEFAULT 0;

-- تاريخ آخر تغيير كلمة مرور
ALTER TABLE users ADD COLUMN passwordChangedAt TEXT;

-- UNIQUE constraint: كل موظف/صاحب عمل مرتبط بحساب واحد فقط
CREATE UNIQUE INDEX idx_users_linked
  ON users(linkedEntityType, linkedEntityId)
  WHERE linkedEntityId IS NOT NULL;

-- ═══ ربط عكسي في employees ═══
ALTER TABLE employees ADD COLUMN userId INTEGER UNIQUE REFERENCES users(id);

-- ═══ ربط عكسي في employers ═══
ALTER TABLE employers ADD COLUMN userId INTEGER UNIQUE REFERENCES users(id);

-- ═══ سجل تسجيل الدخول ═══
CREATE TABLE login_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL REFERENCES users(id),
  loginAt TEXT NOT NULL DEFAULT (datetime('now')),
  deviceInfo TEXT,
  success INTEGER DEFAULT 1,
  failReason TEXT
);
```

### العلاقة بين الجداول

```
┌──────────────────────┐
│       users           │
│                       │
│ id                    │
│ username              │  ← RME-003 (من كود الموظف)
│ passwordHash          │
│ userType ═════════════╪══ 'free' | 'linked'
│ linkedEntityType ═════╪══ 'employee' | 'employer' | NULL
│ linkedEntityId ───────╪──┐
│ mustChangePassword    │  │
│ roleId                │  │
│ isActive              │  │
└──────────────────────┘  │
                           │    linkedEntityType = 'employee'
                           ▼
┌──────────────────────┐  ┌──────────────────────┐
│     employees         │  │     employers         │
│                       │  │                       │
│ id ◄──────────────────┘  │ id ◄─── (إذا employer)│
│ code (RME-003)        │  │ code (RMO-002)        │
│ name                  │  │ nameAr                │
│ imagePath             │  │ imagePath             │
│ userId ───► users.id  │  │ userId ───► users.id  │
│ workBranchId          │  │                       │
│ profession            │  │                       │
└──────────────────────┘  └──────────────────────┘
```

### تدفق أول تسجيل دخول (موظف مرتبط)

```
1. المدير ينشئ حساب مرتبط لـ "أحمد رزق" (RME-003)
   └── كلمة مرور مؤقتة: "Temp@123"
   └── mustChangePassword = true

2. أحمد يفتح التطبيق ويسجل دخول:
   └── اسم المستخدم: RME-003
   └── كلمة المرور: Temp@123

3. النظام يكتشف mustChangePassword = true
   └── يعرض نافذة إلزامية:

   ┌───────────────────────────────────────────┐
   │     🔑 تغيير كلمة المرور (إلزامي)        │
   ├───────────────────────────────────────────┤
   │                                           │
   │  مرحباً أحمد رزق!                        │
   │  يجب تغيير كلمة المرور المؤقتة.          │
   │                                           │
   │  كلمة المرور الحالية: [••••••••]          │
   │  كلمة المرور الجديدة: [••••••••]          │
   │  تأكيد كلمة المرور:   [••••••••]          │
   │                                           │
   │  الشروط:                                  │
   │  ✅ 8 أحرف على الأقل                     │
   │  ✅ حرف كبير + حرف صغير                  │
   │  ✅ رقم واحد على الأقل                    │
   │                                           │
   │              [تغيير كلمة المرور]           │
   │                                           │
   └───────────────────────────────────────────┘

4. بعد التغيير:
   └── mustChangePassword = false
   └── passwordChangedAt = الآن
   └── يدخل للنظام حسب صلاحياته
```

### صلاحيات Super Admin

كـ Super Admin تحتفظ بالقدرة على:

| الإجراء | الوصف |
|---------|-------|
| **عرض جميع الحسابات** | قائمة كاملة بالمستخدمين الأحرار والمرتبطين |
| **إعادة تعيين كلمة المرور** | تعيين كلمة مرور مؤقتة جديدة + تفعيل `mustChangePassword` |
| **تعطيل/تفعيل حساب** | `isActive = false` يمنع الدخول فوراً |
| **فك الربط** | فصل المستخدم عن الموظف (يصبح حر أو يُحذف) |
| **تغيير الدور** | ترقية Staff → Manager أو العكس |
| **عرض سجل الدخول** | من دخل؟ متى؟ من أي جهاز؟ |

### تعديل الأفاتار في الشريط الجانبي

عند الضغط على أفاتار المستخدم:

```
┌─────────────────────────────────────────────┐
│                                             │
│  ┌──────┐  أحمد رزق                       │
│  │ صورة │  بائع — فرع دبي                  │  ← بيانات حية من employees
│  │الموظف│  الدور: مدير فرع (Manager)       │  ← من roles
│  └──────┘  آخر دخول: اليوم 10:30 ص        │  ← من users.lastLoginAt
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  [👤 الملف الشخصي]  [🔑 تغيير كلمة المرور] │
│                                             │
│  [🚪 تسجيل الخروج]                         │
│                                             │
└─────────────────────────────────────────────┘
```

### تعديل `authStore`

```typescript
interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  roleId: number;
  roleName: string;
  // ═══ حقول V1.2 الجديدة ═══
  userType: 'free' | 'linked';
  linkedEntityType?: 'employee' | 'employer';
  linkedEntityId?: number;
  linkedEntityName?: string;       // اسم الموظف/صاحب العمل
  linkedEntityImagePath?: string;  // صورته
  linkedBranchName?: string;       // اسم الفرع
  linkedProfession?: string;       // الوظيفة
  mustChangePassword: boolean;
}
```

---

## V1.3 صفحة حول النظام والتحديثات

### صفحة "حول النظام"

```
┌─────────────────────────────────────────────────────────┐
│                      حول النظام                         │
│                    About the System                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│              ┌──────────┐                                │
│              │  شعار    │                                │
│              │  الرداء  │                                │
│              └──────────┘                                │
│                                                          │
│  🏢 نظام إدارة الرداء الموحد                            │
│     RM DATA Management System                            │
│                                                          │
│  ── معلومات الإصدار ──                                   │
│                                                          │
│  الإصدار:              v1.0.0                            │
│  تاريخ البناء:          2026-03-14                       │
│  وضع التشغيل:          محلي (SQLite)                    │
│  Electron:             v28.x                             │
│  Node.js:              v20.x                             │
│                                                          │
│  ── حالة النظام ──                                       │
│                                                          │
│  ✅ قاعدة البيانات المحلية: متصل                         │
│  ⚠️ الخادم السحابي: غير مُعَدّ بعد                      │
│  ✅ نظام الملفات: يعمل                                   │
│  ✅ آخر نسخة احتياطية: 2026-03-14 03:00                  │
│                                                          │
│  ── الترخيص ──                                           │
│                                                          │
│  مرخّص لـ: شركة الرداء الموحد للملابس الجاهزة           │
│  الدعم الفني: [بريد/هاتف]                                │
│                                                          │
│  ┌─────────────────────┐  ┌────────────────────────────┐ │
│  │ 🔄 التحقق من        │  │ 📋 نسخ معلومات النظام     │ │
│  │    التحديثات         │  │    (للدعم الفني)           │ │
│  └─────────────────────┘  └────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### زر "التحقق من التحديثات"

عند الضغط يتصل بـ:
```
https://rmdata.alredaa-almuwahad.com/api/updates/check?currentVersion=1.0.0
```

الاستجابة:
```json
{
  "hasUpdate": true,
  "latestVersion": "1.1.0",
  "releaseDate": "2026-04-01",
  "releaseNotes": "إصلاح مشكلة المزامنة\nإضافة تقارير جديدة",
  "downloadUrl": "https://rmdata.alredaa-almuwahad.com/releases/rmdata-v1.1.0-setup.exe",
  "isMandatory": false
}
```

إذا يوجد تحديث:

```
┌────────────────────────────────────────────────┐
│  🔔 تحديث جديد متاح!                          │
├────────────────────────────────────────────────┤
│                                                │
│  الإصدار الحالي:  v1.0.0                      │
│  الإصدار الجديد:  v1.1.0                      │
│  تاريخ الإصدار:   2026-04-01                  │
│                                                │
│  التغييرات:                                    │
│  • إصلاح مشكلة المزامنة مع الأفرع            │
│  • إضافة تقارير جديدة                         │
│                                                │
│  [تحميل التحديث]  [تذكيري لاحقاً]  [تخطي]    │
│                                                │
└────────────────────────────────────────────────┘
```

### التنفيذ التقني

```typescript
// electron/updater.ts
import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://rmdata.alredaa-almuwahad.com/releases/'
  });

  // التحقق عند بدء التشغيل
  autoUpdater.checkForUpdates();

  // التحقق كل 6 ساعات
  setInterval(() => autoUpdater.checkForUpdates(), 6 * 60 * 60 * 1000);

  // IPC للتحقق اليدوي من الواجهة
  ipcMain.handle('update:check', async () => {
    const result = await autoUpdater.checkForUpdates();
    return result?.updateInfo || null;
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update:not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update:progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update:ready');
  });

  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}
```

### إعدادات محلية

```sql
INSERT INTO settings (key, value) VALUES
  ('app.version', '1.0.0'),
  ('app.buildDate', '2026-03-14'),
  ('updates.autoCheck', 'true'),
  ('updates.lastCheck', NULL),
  ('updates.channel', 'stable');
```

---

# المرحلة الثانية (V2) — الرؤية المستقبلية

> **هذه المرحلة تُبنى بعد إتمام V1 بالكامل واستقرار النظام السحابي.**

---

## V2.1 تقارير المبيعات والأفرع

### الوصف

نظام تسجيل مبيعات يومية لكل فرع، مع تقارير مقارنة بين الأفرع والموظفين.

### كيف يعمل

```
┌──────────────────────────────────────────────────────┐
│              📊 تسجيل مبيعات اليوم                   │
│              فرع دبي — 14 مارس 2026                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  الموظف: [أحمد رزق ▼]                              │
│                                                      │
│  ┌────────┬──────────┬──────────┬────────┬────────┐  │
│  │ الصنف  │ الكمية   │ السعر    │ الدفع  │ ملاحظة │  │
│  ├────────┼──────────┼──────────┼────────┼────────┤  │
│  │ ثوب   │ 2        │ 450 AED  │ نقدي   │        │  │
│  │ عباية │ 1        │ 380 AED  │ بطاقة  │        │  │
│  │ تعديل │ 3        │ 150 AED  │ نقدي   │ تقصير  │  │
│  └────────┴──────────┴──────────┴────────┴────────┘  │
│                                                      │
│  إجمالي اليوم: 1,280 AED                            │
│  نقدي: 600 | بطاقة: 380 | حساب: 0                   │
│                                                      │
│  [💾 حفظ]                                            │
└──────────────────────────────────────────────────────┘
```

### تقارير المدير

```
┌─────────────────────────────────────────────────┐
│         📈 تقرير المبيعات — مارس 2026           │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────┬────────────┬───────────────────┐ │
│  │ الفرع      │ هذا الشهر  │ الشهر الماضي      │ │
│  ├────────────┼────────────┼───────────────────┤ │
│  │ دبي       │ 45,200 AED │ 42,100 AED (+7%)  │ │
│  │ الشارقة   │ 28,300 AED │ 31,500 AED (-10%) │ │
│  │ عجمان     │ 15,800 AED │ 14,200 AED (+11%) │ │
│  ├────────────┼────────────┼───────────────────┤ │
│  │ الإجمالي   │ 89,300 AED │ 87,800 AED (+2%)  │ │
│  └────────────┴────────────┴───────────────────┘ │
│                                                  │
│  🏆 أعلى مبيعات: أحمد رزق (فرع دبي) 18,500 AED│
│                                                  │
│  [📤 تصدير PDF]  [📊 رسم بياني]                  │
└─────────────────────────────────────────────────┘
```

### هيكلية البيانات

```sql
CREATE TABLE daily_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branchId INT NOT NULL,
  employeeId INT,
  saleDate DATE NOT NULL,
  itemType VARCHAR(50),           -- ثوب، عباية، تعديل، إلخ
  quantity INT DEFAULT 1,
  amount DECIMAL(10,2) NOT NULL,
  paymentMethod ENUM('cash', 'card', 'account') DEFAULT 'cash',
  notes TEXT,
  createdByUserId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_branch_date (branchId, saleDate),
  INDEX idx_employee (employeeId)
) ENGINE=InnoDB;
```

---

## V2.2 بوابة إدارة الفرع (الحضور والغياب)

### الوصف

واجهة مخصصة لمدير كل فرع لإدارة حضور وغياب الموظفين يومياً.

### الواجهة

```
┌──────────────────────────────────────────────────────┐
│           📋 الحضور والغياب — فرع دبي                │
│           14 مارس 2026 (السبت)                       │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────┬──────────┬──────────┬─────────────┐ │
│  │ الموظف      │ الحالة    │ الوقت    │ ملاحظة     │ │
│  ├─────────────┼──────────┼──────────┼─────────────┤ │
│  │ أحمد رزق   │ ✅ حاضر  │ 09:00   │             │ │
│  │ سعيد محمد  │ ✅ حاضر  │ 09:15   │ متأخر 15 د  │ │
│  │ خالد أحمد  │ ❌ غائب  │ —       │ إجازة مرضية │ │
│  │ عمر سالم   │ ✅ حاضر  │ 08:45   │             │ │
│  └─────────────┴──────────┴──────────┴─────────────┘ │
│                                                      │
│  الحضور: 3/4 (75%)                                  │
│                                                      │
│  [💾 حفظ]  [📊 تقرير الشهر]                         │
└──────────────────────────────────────────────────────┘
```

### هيكلية البيانات

```sql
CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId INT NOT NULL,
  branchId INT NOT NULL,
  attendanceDate DATE NOT NULL,
  status ENUM('present', 'absent', 'late', 'leave', 'sick') NOT NULL,
  checkInTime TIME,
  checkOutTime TIME,
  notes TEXT,
  recordedByUserId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_emp_date (employeeId, attendanceDate),
  INDEX idx_branch_date (branchId, attendanceDate)
) ENGINE=InnoDB;
```

---

## V2.3 الخدمة الذاتية للموظفين والملّاك

### الوصف

توسيع صلاحيات المستخدم المرتبط ليتمكن من:

| الميزة | الوصف | المرحلة |
|--------|-------|---------|
| عرض البيانات الشخصية | الاسم، الجنسية، العقد، التأمينات | V1 (أساسي) |
| تغيير كلمة المرور | إلزامي أول مرة + اختياري لاحقاً | V1 (أساسي) |
| عرض المستندات | جواز، عقد، هوية (قراءة فقط) | V2 |
| عرض سجل الحضور | أيام العمل والغياب الشهري | V2 |
| طلب إجازة | يرسل طلب ← المدير يوافق/يرفض | V2 |
| عرض كشف الراتب | ملخص شهري (إذا تم إعداد المالية) | V2 |
| إشعارات شخصية | تنبيه قبل انتهاء الإقامة/الجواز | V2 |

### الواجهة (للموظف)

```
┌─────────────────────────────────────────────┐
│            👤 ملفي الشخصي                   │
│            أحمد رزق — RME-003               │
├─────────────────────────────────────────────┤
│                                             │
│  [بياناتي] [مستنداتي] [حضوري] [إجازاتي]    │
│                                             │
│  ── بياناتي ──                              │
│                                             │
│  الاسم:      أحمد رزق                      │
│  الجنسية:    مصري                           │
│  الوظيفة:    بائع                           │
│  الفرع:      فرع دبي — المرقبات             │
│  العقد:      دوام كامل                      │
│  الراتب:     ████████ (مخفي)               │
│                                             │
│  ── حالة الوثائق ──                         │
│                                             │
│  🟢 جواز السفر: ساري حتى 2027-08-15        │
│  🟡 الإقامة: تنتهي بعد 45 يوم              │
│  🟢 التأمين الصحي: ساري حتى 2027-01-20     │
│                                             │
│  [🔑 تغيير كلمة المرور]                     │
└─────────────────────────────────────────────┘
```

---

## الجدول الزمني

```
══════════════════════════════════════════════════════════════════
  المرحلة الأولى (V1) — التركيز الحالي
══════════════════════════════════════════════════════════════════

الآن → أبريل 2026:
├── ✅ إتمام ترجمة جميع الأقسام (i18n) ← جارٍ حالياً
├── 🔧 V1.3: بناء صفحة "حول النظام" في الإعدادات
├── 🔧 V1.2: ربط users ↔ employees/employers
│         ├── تعديل نافذة إضافة مستخدم (Free / Linked)
│         ├── قائمة بحث الموظفين/أصحاب العمل
│         ├── تغيير كلمة المرور الإلزامي عند أول دخول
│         └── تحديث الأفاتار (بيانات حية)
└── 🔧 V1.3: زر التحقق من التحديثات

مايو → يونيو 2026:
├── 🚀 V1.1: بناء API Server (Node.js + Express + Prisma)
├── 🚀 V1.1: نشره على rmdata.alredaa-almuwahad.com
├── 🚀 V1.1: ترحيل SQLite → MySQL (Hostinger)
├── 🔧 V1.1: إضافة ApiAdapter في Electron
└── 🧪 اختبار مع فرع واحد ثم التعميم

══════════════════════════════════════════════════════════════════
  المرحلة الثانية (V2) — الرؤية المستقبلية (بعد استقرار V1)
══════════════════════════════════════════════════════════════════

يوليو → سبتمبر 2026:
├── 📊 V2.1: نظام تسجيل المبيعات اليومية
├── 📊 V2.1: تقارير المبيعات (يومي/شهري/مقارنة)
└── 📋 V2.2: بوابة الحضور والغياب لمدراء الأفرع

أكتوبر → ديسمبر 2026:
├── 👤 V2.3: بوابة الخدمة الذاتية الموسّعة
├── 📱 V2.3: طلبات الإجازة (موظف ← مدير)
└── 📊 V2.1: كشوف رواتب + تقارير مالية
```

---

## ملخص القرارات المُعتمَدة

| # | البند | القرار |
|---|-------|--------|
| 1 | الاستضافة | **Hostinger** — نطاق فرعي `rmdata.alredaa-almuwahad.com` |
| 2 | قاعدة البيانات السحابية | **MySQL** (متاح في Hostinger) |
| 3 | ORM للخادم | **Prisma** (type-safe، migrations ممتازة مع MySQL) |
| 4 | نمط المستخدم | **نوعان**: مستخدم حر + مستخدم مرتبط بموظف/صاحب عمل |
| 5 | اسم المستخدم المرتبط | **كود الكيان** (RME-003 للموظف، RMO-002 لصاحب العمل) |
| 6 | أول تسجيل دخول | **تغيير كلمة مرور إلزامي** |
| 7 | صلاحية Super Admin | **كاملة**: عرض/إعادة تعيين/تعطيل أي حساب |
| 8 | التحديثات | **زر يدوي** في صفحة "حول النظام" + فحص تلقائي كل 6 ساعات |
| 9 | V2 — بدل تتبع الإنتاج | **تقارير مبيعات** يومية لكل فرع وموظف |
