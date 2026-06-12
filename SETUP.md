# دليل الإعداد والتشغيل

## المتطلبات الأساسية

- Node.js 18 أو أحدث
- npm أو yarn
- Git (اختياري)

## خطوات الإعداد

### 1. تثبيت الحزم

```bash
npm install
```

### 2. بناء ملفات Electron

```bash
npm run build:electron
```

### خادم التطوير API (المنفذ 3001) و MariaDB

`server/dev-api-server.js` يتصل بـ **MariaDB/MySQL** (ليس SQLite). قبل `npm run dev` أو `npm run dev:api` عيّن في البيئة نفس قيم قاعدة البيانات مثل `api-gateway-php/.env`:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

اختياري للملفات (`/api/files/*`): `RMDATA_STORAGE_ROOT` = **مسار مطلق لمجلد التخزين الذي يحتوي فعلياً** المجلدين `images/` و `documents/` على القرص. في التطوير المحلي غالباً `.../api-gateway-php/storage`. **على VPS** إذا رُفعت الملفات تحت مسار مثل `html/storage/` فلا تضع `api-gateway-php/storage` إن لم يكن الملفات هناك — وإلا يعيد الـ API `Not found` رغم وجود الملفات. بعد تغيير القيمة على السيرفر: `pm2 restart rmdata-node-api --update-env` ثم `pm2 env 0 | grep RMDATA` للتحقق. على Linux، المسارات في قاعدة البيانات يجب أن تطابق أسماء المجلدات (`images/`، `documents/`)؛ تم جعل `resolveStorageFile` في Node يتعامل مع `Images`/`Documents` بحرف كبير ويحوّلها للمجلدات الصحيحة.

اختبار ترجمة SQLite→MySQL للاستعلامات العامة:

```bash
npm run test:sqlite-mysql
```

### 3. تشغيل التطبيق في وضع التطوير

```bash
npm run dev
```

هذا الأمر سيقوم بـ:
- تشغيل خادم API للتطوير على المنفذ 3001 (يتصل بـ MariaDB حسب المتغيرات أعلاه)
- تشغيل خادم Vite على المنفذ 5173 (واجهة الويب، متاحة على الشبكة المحلية)
- تشغيل Electron وفتح النافذة الرئيسية

#### اتصال Electron عند استخدام وضع «بعيد» (remote) في التطوير

إذا كان في **الإعدادات → قاعدة البيانات** الوضع **بعيد**، يجب أن يكون عنوان الـ API يشير مباشرة إلى خادم التطوير على المنفذ **3001** (مثل `http://127.0.0.1:3001`)، وليس إلى منفذ Vite فقط (5173). بعد تشغيل `npm run dev` يجب **حفظ الاتصال** مع اسم مستخدم وكلمة مرور صالحين ليُولَّد توكن؛ وإلا قد يظهر في تيرمنال Electron تحذير `Remote db:query failed` ويتم الرجوع تلقائيًا إلى SQLite المحلي. يمكن استخدام زر «تعبئة عنوان التطوير المحلي» في شاشة الإعدادات ثم «حفظ والاتصال».

### فتح الواجهة من الجوال على نفس الشبكة

1. على الكمبيوتر شغّل `npm run dev` (يجب أن يعمل خادم API و Vite).
2. اعرف عنوان IP للكمبيوتر على الشبكة (مثلاً من `ipconfig`: 192.168.100.177).
3. من الجوال (متصل بنفس الـ Wi‑Fi) افتح في المتصفح: `http://192.168.100.177:5173`
4. ستظهر الواجهة والبيانات لأن الطلبات تُوجّه عبر `/api` إلى خادم API على الكمبيوتر.

**ملاحظة**: Electron المحلي يستخدم SQLite في userData؛ خادم API على 3001 يستخدم **MariaDB** إن وُجدت المتغيرات. للتطوير الشبكي مع نفس بيانات الاستضافة، وجّه الاتصال البعيد إلى استضافة PHP أو شغّل MariaDB محلياً بنفس المخطط.

**المستندات والصور من جهاز آخر (شبكة محلية)**  
عند تشغيل `npm run dev`، تُقرأ الملفات من **`RMDATA_STORAGE_ROOT`** (أو `api-gateway-php/storage` افتراضياً في التطوير) تحت `documents/` و`images/`. خادم API يوفّر `GET /api/files/serve` بعد تسجيل الدخول. لمعاينة مستندات رفعها Electron على نفس الجهاز، يجب أن يشير جذر التخزين إلى نفس المسار الذي يكتب فيه التطبيق أو تستخدم بيئة VPS موحّدة.  
**رفع مستند جديد من المتصفح فقط** ما زال يعتمد على وجود مسارات رفع عبر API (غير مفعّلة بالكامل في الوضع الحالي). للمزامنة بين مكتبين عبر الإنترنت يلزم تخزين الملفات على الاستضافة (مثل Hostinger) مع وسيط API — انظر `docs/DATABASE_AND_CONNECTION.md`.

## هيكل المشروع

```
AlRedaa_System/
├── electron/              # ملفات Electron الرئيسية
│   ├── main.ts           # العملية الرئيسية
│   └── preload.ts        # سكريبت ما قبل التحميل
├── src/                   # كود React
│   ├── components/       # المكونات
│   ├── database/         # قاعدة البيانات و Entity Models
│   ├── pages/            # الصفحات
│   ├── store/            # إدارة الحالة (Zustand)
│   ├── utils/            # أدوات مساعدة
│   └── types/            # تعريفات TypeScript
├── database/              # قاعدة البيانات SQLite
└── dist/                  # ملفات البناء (يتم إنشاؤها تلقائياً)
```

## قاعدة البيانات

قاعدة البيانات SQLite يتم إنشاؤها تلقائياً عند أول تشغيل في مجلد `database/uniform_base.db`.

### الجداول الرئيسية:

- **users** - المستخدمون والأدوار
- **entities** - الكيانات القانونية
- **branches** - الأفرع التشغيلية
- **employees** - الموظفون
- **vehicles** - المركبات
- **phones** - الهواتف
- **housing_units** - وحدات السكن
- **notifications** - التنبيهات

### رفع القاعدة على Hostinger (MySQL)

- ملف SQL جاهز للاستيراد: **`database/mysql-schema-rmdata.sql`**
- **قواعد موجودة مسبقاً (ترقية):** لمرحلة الصلاحيات 0.8 شغّل مرة واحدة **`database/mysql-migrate-0.8-permissions.sql`** (يضيف `user_permission_overrides` و`users.permissionVersion`). إذا ظهر خطأ «Duplicate column» للعمود فهو موجود مسبقاً — تجاهل ذلك السطر.
- في phpMyAdmin: اختر قاعدة `u171504308_rmdata_db` → استيراد → اختر الملف ثم تنفيذ.
- الوسيط (API) الذي يقرأ ويحمي القاعدة:
  - **للاستضافة العادية (مثل Hostinger بدون Node):** استخدم مجلد **`api-gateway-php/`** (PHP). راجع `api-gateway-php/README.md` للإعداد ورفع السب دومين.
  - **إن وُجدت Node.js على السيرفر:** يمكن استخدام **`api-gateway/`** (Node.js/Express). راجع `api-gateway/README.md`.

## بيانات تسجيل الدخول الافتراضية

- **اسم المستخدم**: admin
- **كلمة المرور**: admin

## المهام التالية

1. **ربط واجهة المستخدم بقاعدة البيانات**: استخدام IPC handlers للتواصل مع قاعدة البيانات
2. **إكمال نماذج CRUD**: إضافة/تعديل/حذف للكيانات المختلفة
3. **نظام المستندات**: رفع وإدارة الملفات
4. **التقارير**: إنشاء تقارير مفصلة
5. **النسخ الاحتياطي**: نظام نسخ احتياطي تلقائي

## استكشاف الأخطاء

### مشكلة: قاعدة البيانات لا تُنشأ

**الحل**: تأكد من وجود مجلد `database/` وأن لديك صلاحيات الكتابة.

### مشكلة: `SQLITE_ERROR: no such column: city`

**الحل**: نفّذ المايجريشن يدوياً:
```bash
npm run db:migrate
```
أو:
```bash
node scripts/add-city-column.js
```
ثم أعد تشغيل التطبيق.

### مشكلة: Electron لا يفتح

**الحل**: تأكد من تشغيل `npm run build:electron` أولاً.

### مشكلة: `concurrently` is not recognized

**الحل**: تم تعديل سكربت `dev` لاستخدام `npx concurrently`. إذا استمرت المشكلة:
1. أغلق أي نوافذ Terminal أو IDEs مفتوحة على المشروع
2. نفّذ `npm install` في مجلد المشروع (قد تحتاج صلاحيات المدير أو إيقاف البرامج المضادة للفيروسات مؤقتاً)
3. جرّب `npm run dev` مرة أخرى

### مشكلة: 13 خطأ TypeScript (lib.dom.d.ts غير موجودة)

**الحل**: هذه الأخطاء ناتجة عن حزمة `node_modules` غير مكتملة. نفّذ:
```bash
# احذف node_modules يدوياً إن لزم، ثم:
npm install
```
إذا فشل `npm install` مع خطأ EPERM: أغلق VS Code/Cursor، شغّل Terminal كمسؤول (Run as Administrator)، وانتقل لمجلد المشروع ثم نفّذ `npm install`.

### مشكلة: أخطاء TypeScript

**الحل**: قم بتشغيل `npm run typecheck` للتحقق من الأخطاء.

### مشكلة: الصفحة بيضاء / لا يظهر شيء

**الحلول**:
1. **التأكد من المنفذ**: التطبيق يعمل على `http://localhost:5173` (وليس 5137). تأكد أن `vite.config.ts` و `electron/main.ts` يستخدمان نفس المنفذ.
2. **إعادة بناء كاملة**:
   ```bash
   npm run reset
   ```
   أو يدوياً:
   ```bash
   npm run clean
   npm install
   npm run build:electron
   npm run dev
   ```
3. **فحص Console (F12)**: إذا ظهر خطأ "خطأ في تحميل التطبيق" أو "Failed to load resource"، راجع رسائل الخطأ في تبويب Console.
4. **عدم إضافة `"type": "module"`** في `package.json` لأن Electron main يستخدم CommonJS.

### مشكلة: Unable to forward localhost:5173 (spawn code-tunnel.exe ENOENT)

**السبب**: أداة "Forward a Port" في Cursor تعتمد على `code-tunnel.exe` الذي قد لا يكون موجوداً أو مثبتاً في مسار Cursor. هذا يحدث أحياناً في التثبيت المحلي.

**الحل — لا تحتاج إلى Forward a Port للتطوير المحلي**:
- **لتشغيل التطبيق على جهازك**: نفّذ `npm run dev` من الطرفية. سيعمل Vite على المنفذ 5173 ويفتح Electron تلقائياً، أو يمكنك فتح المتصفح على `http://localhost:5173` بعد تشغيل `npm run dev:react`.
- Forward a Port مخصّص عادةً للوصول إلى منفذ على **جهاز بعيد** (مثل SSH أو بيئة سحابية). على جهازك المحلي يكفي تشغيل الأمر وتفتيح الرابط في المتصفح.
- إذا كنت تحتاج فعلاً إلى Port Forwarding (بيئة بعيدة) والخطأ ما زال يظهر: جرّب إعادة تثبيت Cursor أو التحقق من وجود المجلد `bin` داخل مجلد تثبيت Cursor ووجود الملف `code-tunnel.exe` فيه.

## التشغيل على macOS

نفس خطوات التطوير تعمل على الماك:

```bash
npm install
npm run build:electron
npm run dev
```

لبناء ملف تثبيت `.dmg` للتوزيع:

```bash
npm run dist:mac
```

الملف الناتج يكون في مجلد `release/`. عند أول تشغيل قد يطلب macOS السماح بفتح التطبيق من **إعدادات النظام → الخصوصية والأمان** إذا لم يكن موقّعاً بشهادة Apple Developer.

## التحديثات الهوائية (Auto Update) على VPS

تم إعداد التطبيق لقراءة التحديثات حسب النظام:

- ويندوز: `https://api.rmdata.tech/updates/win`
- ماك: `https://api.rmdata.tech/updates/mac`

### إعداد الاستضافة (VPS)

1. أنشئ مجلدًا عامًا داخل موقعك:
   - مثال: `/var/www/api.rmdata.tech/public/updates/win/`
2. تأكد أن الوصول المباشر للملفات يعمل عبر HTTPS.
3. تحقق أن `latest.yml` يفتح كرابط مباشر في المتصفح.

### دورة إصدار تحديث جديد

1. ارفع رقم النسخة في `package.json` (مثال: `1.0.0` إلى `1.0.1`).
2. ابنِ التطبيق:
   - **ويندوز:**
     ```bash
     npm run dist:win
     ```
   - **ماك:**
     ```bash
     npm run dist:mac
     ```
3. من مجلد `release/` ارفع ملفات التحديث:
   - ويندوز → `/var/www/api.rmdata.tech/public/updates/win/`
   - ماك → `/var/www/api.rmdata.tech/public/updates/mac/`

عادة ستحتاج رفع ملفات مثل:
- `latest.yml`
- ملف الـ installer (`.exe`)
- ملف الـ blockmap (`.blockmap`)

### التحقق بعد الرفع

1. افتح رابط:
   - `https://api.rmdata.tech/updates/win/latest.yml`
2. شغّل نسخة أقدم من التطبيق.
3. من صفحة **About** نفّذ فحص يدوي للتحديث، أو انتظر الفحص التلقائي عند التشغيل.
4. عند ظهور "التحديث جاهز للتثبيت"، اختر إعادة التشغيل والتثبيت.

## الدعم

للمساعدة أو الإبلاغ عن مشاكل، يرجى التواصل مع فريق التطوير.

## إغلاق VPS مرحلة 0.5 (Node + PM2 + Backup)

للتشغيل الإنتاجي على VPS وفق خطة v2:

- الدليل التنفيذي: `docs/vps_phase05_closeout.md`
- إعداد PM2: `scripts/vps-setup-node-pm2.sh`
- Bridge Nginx: `scripts/vps-nginx-node-bridge.conf`
- نسخ احتياطي يومي (15 يوم): `scripts/vps-backup-daily.sh`
- فحص الإغلاق: `scripts/vps-verify-phase05.sh`
