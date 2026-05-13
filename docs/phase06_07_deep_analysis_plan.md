# خطة وتحليل عميق للمرحلتين 0.6 و 0.7

> تاريخ الإعداد: أبريل 2026  
> الهدف: الانتقال العملي بعد إغلاق 0.5 إلى Bridge (0.6) مع تنفيذ Schema Alignment (0.7) بشكل متوازٍ ومدروس.

## 1) ملخص الحالة الحالية (واقع الكود)

- البنية الأساسية 0.5 جاهزة: `PHP + MariaDB + Nginx + SSL + PM2`.
- Node API يعمل على `:3001` ويتم ربطه عبر Nginx تحت `/node-api/`.
- التحقق من قاعدة مشتركة تم عبر `scripts/vps-validate-shared-db.sh` (كتابة من Node وقراءة من PHP).
- تطبيق Electron في وضع Remote يستدعي مسارات `/api/*` مباشرة (وليس `/node-api/*` داخل الكود).

## 2) نتائج التحليل العميق (قبل التنفيذ)

## 2.1 طبقة العميل (Electron)

- Electron يعتمد على `/api/auth/login`, `/api/db/query`, `/api/files/*`.
- هذا يعني أن التحويل إلى Node لن يحدث تلقائيا من التطبيق بدون:
  - إما توجيه Nginx ذكي لمسارات `/api/*` المختارة نحو Node.
  - أو تعديل التطبيق/قاعدة URL بطريقة لا تكسر المسارات الحالية.
- ملاحظة مهمة: إذا تم وضع Base URL يتضمن `/node-api` بينما الكود يضيف `/api/...`، سينتج مسار مزدوج مثل `/node-api/api/...`.

## 2.2 طبقة PHP Gateway

- PHP حاليا يوفر فعليا المسارات الأساسية المطلوبة من التطبيق:
  - `auth/login`
  - `auth/change-own-password`
  - `files/list|upload|open|delete`
  - `db/query`
- في 0.6، PHP يجب أن يبقى fallback واضح للمسارات غير المنقولة.

## 2.3 طبقة Node API (dev-api-server.js)

- Node يوفر:
  - `health`
  - `auth/login`
  - `auth/change-own-password`
  - `db/query` مع تحويل SQLite->MySQL
  - أجزاء من `files` (`list/open/serve/delete`)
  - REST موارد (`branches/employees/employers/housing/vehicles/users/stats`)
- تم إغلاق فجوة `POST /api/files/upload` في Node، والتحقق على VPS بنجاح.
- تم توسيع CORS methods لتشمل `PUT/DELETE`.

## 2.4 فجوات مطابقة الـ Schema (0.7)

توجد مؤشرات قوية لعدم تطابق بين REST في Node وبين `database/mysql-schema-rmdata.sql`، مثل:

- `housing` في Node مقابل `housing_units` في schema.
- أعمدة في Node لا تظهر في schema الحالية لبعض الجداول (أمثلة متداولة في المراجعة: `managerName`, `idNumber`, `color`, `isArchived` لبعض الكيانات).
- endpoint الإحصائيات قد يفترض أعمدة/جداول غير متوفرة فعليا.

النتيجة: لا يجوز قطع التحويل الكامل إلى Node قبل إغلاق مصفوفة التوافق Endpoint ↔ Table/Columns.

## 2.5 فجوة عقد المصادقة

- PHP يعتمد JWT بعقد معروف.
- Node يدعم الآن JWT parity (مع fallback legacy token أثناء الانتقال).
- التحقق على VPS أكد إصدار JWT فعلي (`xxx.yyy.zzz`) بعد ضبط `JWT_SECRET` في PM2 env.

## 3) قرار التنفيذ المتوازي (0.6 + 0.7)

## 3.1 مبدأ العمل

- 0.6 (Bridge): نقل تدريجي بدون توقف.
- 0.7 (Schema): إصلاح الجذور التقنية بالتوازي حتى لا يتراكم دين تقني.
- القاعدة: لا نقل Endpoint إلى Node في الإنتاج إلا بعد:
  1) نجاح اختبار العقد (response shape)
  2) نجاح اختبار schema (SELECT/INSERT/UPDATE على MariaDB الفعلي)
  3) وجود fallback فوري إلى PHP.

## 3.2 تصنيف المسارات المقترح الآن

- **Move now (بعد تحقق سريع):**
  - `GET /health`
  - `POST /db/query` (مع حصر الاستعلامات المعتمدة ومراقبة دقيقة)
- **Keep on PHP حاليا:**
  - `POST /files/upload` (غير موجود في Node حاليا)
  - أي endpoint Node لديه mismatch واضح مع schema
  - أي endpoint يحتاج JWT contract موحد ولم يُحسم بعد
- **Candidate بعد إصلاح 0.7:**
  - REST الموارد (`branches`, `employees`, `employers`, `housing`, `vehicles`, `stats`)

## 4) خطة العمل التنفيذية

## المرحلة A (اليوم 1-2): تثبيت Bridge الحقيقي (0.6)

- [x] إنشاء ملف جرد رسمي للمسارات: `docs/phase06_endpoint_inventory.md`
  - الأعمدة: Endpoint | المستهلك (Electron/Browser) | حاليا PHP/Node | قرار 0.6 | ملاحظات.
- [ ] إضافة توجيه Nginx انتقائي للمسارات التي ستنتقل فعليا إلى Node (وليس تعميم غير آمن).
- [x] تفعيل مراقبة logs أساسية:
  - `pm2 logs rmdata-node-api`
  - `nginx access/error` مع فلتر للمسارات المنقولة.
- [x] كتابة Rollback Runbook قصير:
  - كيف نعيد endpoint من Node إلى PHP خلال دقائق.

## المرحلة B (اليوم 2-5): إغلاق فجوات 0.7 الحرجة

- [x] بناء مصفوفة توافق تفصيلية: `Endpoint -> SQL -> Table/Columns -> الحالة`. (انظر `docs/phase07_schema_matrix.md`)
- [x] إصلاح جدول/أسماء الأعمدة في Node (خصوصا `housing` مقابل `housing_units`).
- [x] إضافة/إكمال `POST /api/files/upload` في Node بعقد مماثل للتطبيق.
- [x] توحيد response shape للأخطاء والنجاح (حتى لا تتكسر IPC عند التحويل) لمسارات `auth/files/housing`.
- [x] مراجعة auth contract (JWT أو سياسة انتقال موثقة بوضوح). (JWT parity مع fallback legacy token أثناء الانتقال)

## المرحلة C (اليوم 5-7): تحقق قبول + توسيع تدريجي

- [x] اختبار يدوي/شبه آلي لكل endpoint أساسي (جزء B المغلق):
  - login
  - db:query
  - files upload/open (الصيغتين: `documents/...` وبدون البادئة)
  - مسار مورد واحد على الأقل من REST (`housing`)
- [x] بدء نقل endpoint واحد منخفض المخاطر إلى Node في الإنتاج. (canary `/api/health` ناجح)
- [ ] تثبيت مؤشرات مراقبة (نسبة 5xx, زمن الاستجابة, أخطاء SQL).
- [ ] قرار Go/No-Go أسبوعي للتوسعة.

## 5) قائمة المشاكل التي يجب حلها قبل اعتبار 0.6+0.7 منجزة

- [x] لا يوجد `files/upload` في Node بينما العميل يعتمد عليه.
- [ ] عدم تطابق schema في REST Node مع MariaDB الفعلي. (انخفضت الفجوة بعد إصلاح `housing/branches/employers/vehicles` وما زالت قائمة في `employees`)
- [x] اختلاف contract المصادقة بين PHP وNode.
- [x] غياب جرد endpoint رسمي مع ownership واضح.
- [ ] غياب اختبارات API تكاملية كافية لمسارات الإنتاج.
- [ ] غياب Rollback موثق ومجرب لكل endpoint يتم نقله.

## 6) Definition of Done

## اكتمال 0.6

- [x] لدينا Inventory نهائي + قرارات migration لكل endpoint.
- [x] مسارات Node المنقولة مراقبة مع fallback فعلي مجرب.
- [x] لا يوجد انقطاع خدمة أثناء نقل أي endpoint (ضمن نطاق B المختبر).

## اكتمال 0.7

- [ ] كل endpoint Node المنوي استخدامه متطابق 100% مع schema الفعلي.
- [x] تقرير توافق نهائي موجود ومرجعي. (مرحلي: `docs/phase07_schema_matrix.md`)
- [x] `files/upload` متاح ومتوافق مع التطبيق.
- [x] اختبارات القبول الأساسية (B scope: `health/login/db-query/files/housing`) ناجحة في بيئة VPS.

## 7) ترتيب التنفيذ المقترح للأسبوع القادم

1. بدء نقل endpoint منخفض المخاطر (canary) في الإنتاج وفق inventory.
2. إصلاح `branches` على schema الفعلي (`status` بدل `isArchived` + حذف `managerName` غير الموجود).
3. إصلاح `vehicles` على schema الفعلي ثم اختبار Node lane قبل canary.
4. إصلاح `employees` (الأكثر تعقيداً) بمطابقة أعمدة schema الفعلية.
5. توسيع smoke/contract tests وتحديث `phase07_schema_matrix.md` بعد كل مورد.

## سجل التنفيذ الفعلي (حتى الآن)

### ما تم إنجازه فعلياً

- تم إغلاق **المرحلة A** توثيقياً وتشغيلياً (Inventory + Policy + Monitoring + Rollback).
- تم إغلاق **المرحلة B تشغيلياً** على VPS:
  - `health` ناجح.
  - `login` ناجح.
  - `db/query` ناجح.
  - `files/upload` ناجح.
  - `files/open` ناجح (مع دعم الصيغتين: `documents/...` وبدون البادئة).
- تم تفعيل **JWT parity** فعلياً على VPS بعد ضبط `JWT_SECRET` في PM2 env.
- تم إصلاح mismatch `housing -> housing_units` في Node.
- تم تنفيذ **canary step 1** بنجاح:
  - تحويل `/api/health` إلى Node عبر Nginx.
  - التحقق: `nginx -t` + `curl /api/health` + `curl /node-api/health` + logs بدون أخطاء.
  - النتيجة: **أول cutover فعلي منخفض المخاطر تم بنجاح**.

### قرار المرحلة التالية (معتمد)

- بعد مقارنة خيار `db/query canary` مع خيار `branches`:
  - تم اعتماد أن **الخطوة القادمة تكون `branches` أولاً** (أوضح تشخيصاً وأقل مخاطرة).
  - `db/query canary` يبقى خيار لاحق بعد تقدم إصلاحات الموارد.

## الخطوة القادمة (البدء الفوري)

1. تنفيذ إصلاح `branches` في `dev-api-server.js` ليطابق schema الفعلي:
   - الاعتماد على `status` بدل `isArchived`.
   - إزالة `managerName` غير الموجود في schema.
2. اختبار `branches` على Node lane (`/node-api/...`) قبل أي cutover.
3. تحديث `docs/phase07_schema_matrix.md` بنتيجة الإصلاح.
4. اتخاذ قرار Go/No-Go لنقل `branches` كـ canary endpoint تالي.

## Progress update (الآن)

- تم تنفيذ إصلاح `branches` في الكود (`server/dev-api-server.js`) كما يلي:
  - التحويل إلى `status` بدل `isArchived`.
  - إزالة `managerName` غير الموجود.
  - مواءمة list/create/update/delete مع أعمدة `branches` الفعلية في schema.
- تم اجتياز فحص syntax محلياً: `node --check server/dev-api-server.js`.
- تم تنفيذ smoke test على VPS لمسارات `node-api/branches*` بنجاح كامل (GET/POST/GET:id/PUT/DELETE/archive-filter).
- تم تنفيذ **canary step 2** بنجاح على المسار الإنتاجي `api/branches*` بدون أخطاء تشغيلية.
- تم تنفيذ إصلاح `employers` في الكود واختباره بنجاح على Node lane.
- تم تنفيذ **canary step 3** بنجاح على المسار الإنتاجي `api/employers*` (CRUD + archive) بدون أخطاء تشغيلية.
- تم تنفيذ إصلاح `vehicles` في الكود (`status` بدل `isArchived` + إزالة `color` غير الموجود مع alias توافقي).
- تم تنفيذ smoke كامل لـ `vehicles` على Node lane بنجاح (CRUD + archive-filter).
- تم تنفيذ **canary step 4** بنجاح على المسار الإنتاجي `api/vehicles*` (CRUD + archive) بدون أخطاء تشغيلية.
- تم تنفيذ إصلاح `employees` في الكود بمواءمة schema + aliases توافقية.
- تم تنفيذ smoke كامل لـ `employees` على Node lane بنجاح (List + Create + GetById + Update + Archive).
- تم تنفيذ **canary step 5** بنجاح على المسار الإنتاجي `api/employees*` بدون أخطاء تشغيلية.
- تم تنفيذ مواءمة `phones` في Node وإصلاح bug جزئي في `PUT` (الحفاظ على provider/category/numberType عند partial update).
- تم تنفيذ smoke كامل لـ `phones` على Node lane بنجاح.
- تم تنفيذ **canary step 6** بنجاح على المسار الإنتاجي `api/phones*` (List + Create + Update + Archive).
- تم تنفيذ مواءمة `tax/settings` في Node (CRUD + link/unlink حسب schema الفعلي).
- تم تنفيذ smoke كامل لـ `tax/settings` على Node lane بنجاح.
- تم تنفيذ **canary step 7** بنجاح على المسار الإنتاجي (`api/settings*` + `api/tax/*`).
- الخطوة التالية المباشرة: تثبيت إغلاق 0.7 رسميًا والانتقال إلى 0.8.

## Snapshot تشغيلي (بعد canary step 1)

- تم **نجاح canary `/api/health`** على الإنتاج بعد تفعيل التوجيه الانتقائي في Nginx.
- هذا يمثل **أول cutover فعلي منخفض المخاطر** من PHP إلى Node بدون انقطاع.
- التحقق التشغيلي: `nginx -t` ناجح + `curl /api/health` ناجح + `curl /node-api/health` ناجح + لا أخطاء جديدة في `pm2 logs`.

## Snapshot تشغيلي (بعد canary step 2)

- تم نجاح canary endpoint لمجموعة `api/branches*` (List + Create + GetById + Update + Archive).
- التحقق كان على **المسار الإنتاجي `/api/branches`** (وليس `node-api` فقط) مع token فعلي.
- لا أخطاء جديدة في `pm2 logs` أثناء اختبارات CRUD.
- النتيجة: الانتقال التدريجي مستقر، والمرشح التالي للإصلاح/النقل هو `employers`.

## Snapshot تشغيلي (بعد canary step 3)

- تم نجاح canary endpoint لمجموعة `api/employers*` (List + Create + GetById + Update + Archive).
- التحقق كان على **المسار الإنتاجي `/api/employers`** مع token فعلي.
- لا أخطاء جديدة في `pm2 logs` أثناء اختبارات CRUD.
- النتيجة: الانتقال التدريجي مستقر، والمرشح التالي للإصلاح/النقل هو `vehicles`.

## Snapshot تشغيلي (بعد إصلاح vehicles في الكود)

- تم إغلاق فجوة schema لمسارات `vehicles` داخل `server/dev-api-server.js`.
- تم تحويل منطق list/filter/archive من `isArchived` إلى `status`.
- تم إزالة الاعتماد على عمود `color` غير الموجود في DB مع إبقاء alias توافقي (`color -> vehicleType`) لتجنب كسر العميل.
- المتبقي قبل canary: smoke test على VPS لمسارات `node-api/vehicles*` ثم Go/No-Go.

## Snapshot تشغيلي (بعد canary step 4)

- تم نجاح canary endpoint لمجموعة `api/vehicles*` (List + Create + GetById + Update + Archive).
- التحقق تم على **المسار الإنتاجي `/api/vehicles`** مع token فعلي، مع نجاح archive-filter (`isArchived=1`).
- لا أخطاء تشغيلية جديدة في `pm2 logs` أثناء اختبارات CRUD.
- النتيجة: الانتقال التدريجي مستقر، والمورد المتبقي في 0.7 هو `employees`.

## Snapshot تشغيلي (بعد canary step 5)

- تم نجاح canary endpoint لمجموعة `api/employees*` على الإنتاج.
- التحقق تم عبر `/api/employees` مع token فعلي بعد تفعيل route في Nginx.
- لا أخطاء تشغيلية جديدة بعد `nginx -t && systemctl reload nginx`.
- النتيجة: **تم إغلاق فجوات 0.7 الحرجة للموارد الأساسية (housing/branches/employers/vehicles/employees)**.

## Snapshot تشغيلي (بعد canary step 6)

- تم نجاح canary endpoint لمجموعة `api/phones*` على الإنتاج.
- تم التحقق من list/create/update/archive عبر المسار الإنتاجي `/api/phones` مع token فعلي.
- تم إصلاح مشكلة partial update في `PUT /api/phones/:id` (عدم تحويل provider/category/numberType إلى null).
- النتيجة: الانتقال التدريجي مستمر بثبات، والمرحلة التالية المنطقية هي `tax/settings`.

## Snapshot تشغيلي (بعد canary step 7)

- تم نجاح canary endpoint لمجموعة `api/settings*` (list/get/upsert/delete) على الإنتاج.
- تم نجاح canary endpoint لمجموعة `api/tax/*` (payments CRUD + entity-branches link/unlink) على الإنتاج.
- `nginx -t` و`reload` ناجحان بدون أخطاء تشغيلية مرافقة.
- النتيجة: **تم إغلاق نطاق 0.7 المخطط (`resources + phones + tax + settings`) تشغيليًا**.

## Snapshot تشغيلي (بعد canary step 8)

- تم نجاح canary endpoint لمجموعة `api/housing*` على الإنتاج (List + Create + GetById + Update + Archive).
- تم التحقق من `isArchived=1` على مسار الإنتاج بنجاح.
- لا أخطاء تشغيلية بعد تفعيل route في Nginx وإعادة التحميل.
- النتيجة: تم تأكيد نقل جميع الموارد الأساسية المتفق عليها إلى Node على مسار `/api/*`.

---

## مراجع كود يجب الرجوع لها أثناء التنفيذ

- `server/dev-api-server.js`
- `server/mysql-db.js`
- `server/sqlite-to-mysql.js`
- `api-gateway-php/api/index.php`
- `api-gateway-php/src/auth.php`
- `electron/remote-api-utils.ts`
- `electron/ipc/settings-ipc.ts`
- `electron/ipc/auth-ipc.ts`
- `scripts/vps-nginx-node-bridge.conf`
- `scripts/vps-validate-shared-db.sh`
- `database/mysql-schema-rmdata.sql`
