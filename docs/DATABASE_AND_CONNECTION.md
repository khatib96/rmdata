# قاعدة البيانات والاتصال — توثيق شامل

> **آخر تحديث:** مارس 2026  
> يشرح هذا المستند كل ما يتعلق بقاعدة البيانات (محلي/بعيد)، إعداد الاتصال، والوسيط API.

---

## فهرس المحتويات

1. [نظرة عامة](#1-نظرة-عامة)
2. [قاعدة البيانات المحلية (SQLite)](#2-قاعدة-البيانات-المحلية-sqlite)
3. [إعداد الاتصال البعيد من التطبيق](#3-إعداد-الاتصال-البعيد-من-التطبيق)
4. [تخزين إعداد الاتصال (Electron)](#4-تخزين-إعداد-الاتصال-electron)
5. [الوسيط API (PHP على Hostinger)](#5-الوسيط-api-php-على-hostinger)
6. [التحقق من العمل على أكثر من جهاز](#6-التحقق-من-العمل-على-أكثر-من-جهاز)
7. [الملفات ذات الصلة](#7-الملفات-ذات-الصلة)
8. [حالة التنفيذ والخطوات القادمة](#8-حالة-التنفيذ-والخطوات-القادمة)

---

## 1. نظرة عامة

| الوضع | الوصف | الاستخدام الحالي |
|-------|--------|------------------|
| **محلي (Local)** | SQLite على جهاز المستخدم داخل مجلد بيانات التطبيق | ✅ مفعّل افتراضياً — كل البيانات والاستعلامات محلية |
| **بعيد (Remote)** | الاتصال عبر HTTPS إلى وسيط API يقرأ/يكتب MySQL على السيرفر (Hostinger) | ✅ إعداد الاتصال وحفظه واختباره جاهز — استخدام البيانات من الـ API عند وضع «بعيد» قيد الإكمال |

- التطبيق (Electron + React) يحدد **وضع التشغيل** من إعداد محفوظ: `local` أو `remote`.
- في الوضع **المحلي**: كل الاستعلامات تمر عبر `window.electronAPI.dbQuery` إلى SQLite.
- في الوضع **البعيد**: يُفترض لاحقاً أن تمر الطلبات عبر عنوان الـ API المحفوظ (تسجيل دخول + JWT ثم جلب الكيانات/الأفرع/الموظفين من الـ API). واجهة الإعدادات وحفظ الإعداد واختبار الاتصال مكتملة.

---

## 2. قاعدة البيانات المحلية (SQLite)

### 2.1 المسار وتهيئة المسار

- **مصدر الحقيقة لمسار الملف:**  
  `electron/set-db-path.ts` يُنفَّذ **قبل** تحميل `data-source` (يُستورد أولاً في `electron/main.ts`).
- **المسار الفعلي:**  
  `app.getPath('userData') + '/uniform_base.db'`  
  أي على Windows مثلاً:  
  `%APPDATA%\RMDATA.System\uniform_base.db` (أو حسب `productName` في Electron).
- **متغير البيئة:**  
  يتم تعيين `process.env.ELECTRON_DB_PATH` إلى هذا المسار؛ `src/database/data-source.ts` يقرأ منه إن وُجد، وإلا يستخدم مساراً افتراضياً داخل المشروع (للتطوير/الاختبار).

### 2.2 تهيئة الاتصال والـ PRAGMA

- الملف: **`src/database/data-source.ts`**.
- **TypeORM** مع `type: 'sqlite'` و `database: getDatabasePath()`.
- عند التهيئة:
  - `PRAGMA journal_mode = DELETE`
  - `PRAGMA synchronous = FULL`
  - `PRAGMA foreign_keys = ON`
- يتم تشغيل ترحيلات (migrations) داخل المجلد `src/database/migrations/` لضمان أعمدة إضافية في الأفرع، المركبات، السكن، الهواتف، إلخ.

### 2.3 الجداول الرئيسية (الكيانات)

| الجدول | الوصف |
|--------|--------|
| `users` | المستخدمون والأدوار وتجزئة كلمة المرور (bcrypt) |
| `roles`, `permissions`, `role_permissions` | الأدوار والصلاحيات |
| `entities` (LegalEntity) | الكيانات القانونية/الضريبية |
| `branches` | الأفرع والمنشآت |
| `employees` | الموظفون |
| `employers` | أصحاب العمل |
| `branch_employers` | ربط الأفرع بأصحاب العمل |
| `vehicles` | المركبات |
| `phones` | الهواتف |
| `housing_units`, `housing_installments`, `housing_occupants` | السكن والدفعات والسكان |
| `branch_licenses`, `branch_leases`, `lease_installments` | التراخيص وعقود الإيجار |
| `documents` | المستندات (مسار نسبي داخل `userData/documents/`) |
| `notifications` | التنبيهات |
| `activity_logs` | سجل النشاط |

### 2.4 استعلامات قاعدة البيانات من الواجهة

- كل الاستعلامات المحلية تتم عبر **IPC**:  
  `window.electronAPI.dbQuery(query, params?)`  
  المُعرَّف في **`electron/preload.ts`** ويستدعي المعالج **`db:query`** في **`electron/main.ts`**.
- النتيجة: `{ success, data?, lastInsertId?, error? }`.

---

## 3. إعداد الاتصال البعيد من التطبيق

### 3.1 أين تظهر الإعدادات؟

- **الإعدادات → قاعدة البيانات**  
  المسار في الواجهة: `/settings/database`  
  المكوّن: **`src/components/Settings/sections/DatabaseSettings.tsx`**.

### 3.2 محتوى الشاشة

1. **محرك قاعدة البيانات (بطاقة):**
   - النوع: SQLite3.
   - وضع التشغيل: **محلي (Local)** أو **بعيد (API)** حسب الإعداد المحفوظ.
   - الحالة: متصل (أخضر).

2. **ملخص البيانات (بطاقة):**
   - عدد الجداول، إجمالي السجلات (من القاعدة المحلية).

3. **اتصال بقاعدة بيانات عن بُعد (قسم نموذج):**
   - **عنوان الـ API:** حقل URL (مثال: `https://rmdata.alredaa-almuwahad.com`).
   - **اسم المستخدم** و**كلمة المرور:** لإدخال بيانات الدخول للسيرفر (كلمة المرور لا تُحفظ).
   - **اختبار الاتصال:** يطلب `GET {apiBaseUrl}/api/health` ويعرض نجاح/فشل (ويُظهر إن كانت قاعدة البيانات على السيرفر متاحة إن أرجعت الاستجابة حقل `database`).
   - **حفظ والاتصال:** يختبر أولاً، ثم يحفظ الوضع `remote` مع `apiBaseUrl` و`apiUsername` (بدون كلمة مرور).
   - **العودة للعمل المحلي:** يحفظ الوضع `local` ويُزيل اعتماد الاتصال البعيد.

### 3.3 الترجمة (i18n)

- المفاتيح تحت `settings.*` في **`src/locales/ar.json`** و **`src/locales/en.json`**، منها:
  - `dbModeRemote`, `dbRemoteTitle`, `dbRemoteDesc`, `dbApiUrl`, `dbApiUrlPlaceholder`, `dbApiUsername`, `dbApiPassword`, `dbTestConnection`, `dbSaveAndConnect`, `dbSwitchToLocal`, `dbConnectionSuccess`, `dbConnectionFailed`, `dbSaved`.

---

## 4. تخزين إعداد الاتصال (Electron)

### 4.1 الملف والمكان

- **اسم الملف:** `db-connection.json`
- **المسار:** `app.getPath('userData')` (نفس مجلد بيانات التطبيق الذي فيه `uniform_base.db`).

### 4.2 هيكل الملف

```json
{
  "mode": "local",
  "apiBaseUrl": "https://rmdata.alredaa-almuwahad.com",
  "apiUsername": "admin"
}
```

- **mode:** `"local"` أو `"remote"`.
- **apiBaseUrl:** عنوان أساس الـ API (بدون `/api` في النهاية).
- **apiUsername:** اسم المستخدم المُدخل (اختياري؛ كلمة المرور لا تُخزَّن أبداً).

### 4.3 معالجات IPC (في `electron/main.ts`)

| المعالج | الوظيفة |
|---------|---------|
| `settings:getDatabaseConnection` | قراءة الإعداد من `db-connection.json` وإرجاعه للواجهة. |
| `settings:setDatabaseConnection` | كتابة الإعداد (mode, apiBaseUrl, apiUsername) إلى الملف. |
| `settings:testApiConnection` | تنفيذ `GET {apiBaseUrl}/api/health` (مع timeout 10 ثوانٍ) وإرجاع `{ success, ok, database?, error? }`. |

### 4.4 التعرض للواجهة (preload و TypeScript)

- في **`electron/preload.ts`**:  
  `getDatabaseConnection`, `setDatabaseConnection`, `testApiConnection` مُعرَّفة على `window.electronAPI`.
- في **`src/types/electron.d.ts`**:  
  واجهة **`DatabaseConnectionConfig`** ووظائف **`getDatabaseConnection`**, **`setDatabaseConnection`**, **`testApiConnection`** ضمن **`ElectronAPI`**.

---

## 5. الوسيط API (PHP على Hostinger)

### 5.1 الغرض والنطاق

- وسيط يعمل على **PHP** (لا يعتمد على Node.js) ليتوافق مع خطط الاستضافة الأساسية في Hostinger.
- النطاق الفرعي المستخدم: **`rmdata.alredaa-almuwahad.com`**.
- الصفحة الرئيسية للموقع تعرض **صفحة تمويه** فقط («قيد التطوير» + شعار)؛ لا إشارة لوجود API.
- مسارات الـ API تحت **`/api/*`** (مثلاً `/api/health`, `/api/auth/login`, `/api/entities`).

### 5.2 مشروع الوسيط

- المجلد: **`api-gateway-php/`**.
- نقطة الدخول للـ API: **`api-gateway-php/api/index.php`** (يُوجَّه إليه عبر `.htaccess` من `/api/*`).
- التكوين: **`config/config.php`**, **`config/db.php`** (اتصال PDO بـ MySQL)، وملف بيئة **`.env`** (محمي عبر `.htaccess`).

### 5.3 مسارات الـ API ذات الصلة بالاتصال والبيانات

| المسار | الطريقة | الوظيفة |
|--------|---------|----------|
| `/api/health` | GET | فحص صحة الخدمة؛ يُرجع `{ ok, timestamp, database }` — و`database: true` يعني أن اتصال MySQL يعمل (يتم تنفيذ `SELECT 1`). |
| `/api/auth/login` | POST | Body: `{ username, password }` — يتحقق من المستخدم وكلمة المرور ويُرجع JWT + بيانات المستخدم. |
| `/api/entities` | GET | قائمة الكيانات (يتطلب مصادقة JWT). |
| `/api/entities/:id` | GET | تفاصيل كيان. |
| `/api/branches`, `/api/branches/:id` | GET | الأفرع. |
| `/api/employees`, `/api/employees/:id` | GET | الموظفون. |

المصادقة: JWT (مكتبة `firebase/php-jwt`). الصلاحيات عبر جداول `role_permissions` و`permissions`؛ دور Admin يمرر كل الصلاحيات.

### 5.4 الإعداد على Hostinger

- رفع محتويات **`api-gateway-php`** إلى مجلد السب دومين.
- نسخ **`.env.example`** إلى **`.env`** وملء: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`.
- تشغيل **`composer install`** داخل مجلد `api-gateway-php` (أو رفع مجلد `vendor/` بعد التثبيت محلياً).
- وضع شعار الشركة باسم **`logo.png`** في الجذر لصفحة التمويه.

تفاصيل أكثر: **`api-gateway-php/README.md`**.

### 5.5 قاعدة البيانات على السيرفر

- **MySQL** على Hostinger.
- هيكل الجداول يمكن استيراده من ملف SQL للمشروع (مثل **`database/mysql-schema-rmdata.sql`** إن وُجد) عبر phpMyAdmin أو أداة استيراد أخرى.

---

## 6. التحقق من العمل على أكثر من جهاز

### 6.1 فحص صحة الـ API من أي جهاز

- من المتصفح (كمبيوتر، جوال، شبكة أخرى):  
  افتح: **`https://rmdata.alredaa-almuwahad.com/api/health`**
- استجابة ناجحة تحتوي على **`database: true`** تعني أن الخدمة وقاعدة البيانات على السيرفر تعملان.

### 6.2 من التطبيق (Electron)

- في **الإعدادات → قاعدة البيانات** أدخل عنوان الـ API (نفس الرابط بدون `/api/health`) ثم اضغط **اختبار الاتصال**.
- إن ظهرت رسالة نجاح (وقاعدة البيانات متاحة)، يمكن الضغط **حفظ والاتصال** لتفعيل الوضع البعيد في هذا الجهاز.

### 6.3 اختبار تسجيل الدخول ومسارات محمية

- باستخدام أداة مثل Postman أو Thunder Client:
  - **POST** `https://rmdata.alredaa-almuwahad.com/api/auth/login`  
    Body (JSON): `{ "username": "...", "password": "..." }`.
  - استخدام التوكن المُرجَع في رأس **Authorization: Bearer &lt;token&gt;** لطلب **GET** مثلاً:  
    `https://rmdata.alredaa-almuwahad.com/api/entities`.  
- نجاح الطلبات من جهازين أو شبكتين مختلفتين يؤكد أن الـ API وقاعدة البيانات تعملان من أكثر من جهاز.

---

## 7. الملفات ذات الصلة

| الملف أو المجلد | الوصف |
|-----------------|--------|
| **`electron/set-db-path.ts`** | تعيين مسار SQLite ونسخ قاعدة قديمة إن وُجدت. |
| **`electron/main.ts`** | معالجات IPC: `db:query`, `settings:getDatabaseConnection`, `settings:setDatabaseConnection`, `settings:testApiConnection`؛ وتهيئة TypeORM. |
| **`electron/preload.ts`** | تعريض `dbQuery`, `getDatabaseConnection`, `setDatabaseConnection`, `testApiConnection` للواجهة. |
| **`src/database/data-source.ts`** | تهيئة TypeORM واتصال SQLite والـ PRAGMA والترحيلات. |
| **`src/database/entities/`** | كيانات TypeORM (User, Branch, Employee, إلخ). |
| **`src/components/Settings/sections/DatabaseSettings.tsx`** | واجهة إعدادات قاعدة البيانات والاتصال البعيد. |
| **`src/types/electron.d.ts`** | تعريفات `ElectronAPI` و`DatabaseConnectionConfig`. |
| **`src/locales/ar.json`**, **`src/locales/en.json`** | مفاتيح الترجمة لقسم قاعدة البيانات والاتصال. |
| **`api-gateway-php/`** | وسيط API بـ PHP (Hostinger). |
| **`api-gateway-php/README.md`** | إعداد الوسيط ورفعه واستكشاف الأخطاء. |
| **`SETUP.md`** | دليل الإعداد والتشغيل وملاحظة رفع القاعدة على Hostinger. |
| **`docs/SYSTEM_EVOLUTION_PLAN.md`** | خطة التطوير (V1.1 التكامل السحابي، API، MySQL). |
| **`docs/SETTINGS_IMPLEMENTATION_PLAN.md`** | خطة تنفيذ الإعدادات وقسم قاعدة البيانات. |

---

## 8. حالة التنفيذ والخطوات القادمة

### ما تم تنفيذه

- قاعدة بيانات محلية SQLite كاملة مع TypeORM ومسار في `userData` وترحيلات.
- إعداد الاتصال البعيد في الإعدادات: حقول API URL، اسم مستخدم، كلمة مرور، أزرار اختبار الاتصال وحفظ والاتصال والعودة للمحلي.
- تخزين الإعداد في `db-connection.json` وقراءته/كتابته عبر IPC.
- عرض وضع التشغيل (محلي/بعيد) في بطاقة «محرك قاعدة البيانات».
- وسيط API بـ PHP على Hostinger مع `/api/health` (مع فحص اتصال MySQL)، `/api/auth/login`، ومسارات للكيانات والأفرع والموظفين مع JWT وصلاحيات.

### ما المتبقي (اختياري / لاحق)

- **استخدام البيانات البعيدة فعلياً في التطبيق:** عند اختيار الوضع «بعيد»:
  - تسجيل الدخول عبر **POST /api/auth/login** واستخدام JWT في الطلبات التالية.
  - توجيه جلب البيانات (الكيانات، الأفرع، الموظفين، إلخ.) إلى الـ API بدلاً من `dbQuery` عند الوضع البعيد (طبقة بيانات موحدة أو تحويل المكونات لاستخدام مصدر بيانات حسب الوضع).
- مؤشر اتصال في الشريط العلوي (متصل / جاري المزامنة / غير متصل) عند استخدام الوضع البعيد.
- إبقاء SQLite كنسخة احتياطية محلية (Offline fallback) عند انقطاع الاتصال بالسيرفر.

---

*هذا المستند جزء من توثيق مشروع RMDATA_SYSTEM — نظام إدارة الرداء الموحد.*
