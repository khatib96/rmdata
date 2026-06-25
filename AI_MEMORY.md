# AI_MEMORY - RMDATA System

آخر تحديث: 2026-06-24
الغرض: هذا الملف هو ذاكرة عمل مشتركة بين صاحب المشروع، المبرمجين، وأدوات الذكاء الاصطناعي. يتم تحديثه بعد كل جلسة مهمة حتى لا نعيد تحليل المشروع من الصفر.

> المرجع الأساسي الحالي: `docs/RMDATA_MASTER_PLAN_2026.md`.
> عند التعارض بين هذه الذاكرة والخطط القديمة، تُراجع الخطة الرئيسية الجديدة أولاً.

## 1. تعريف سريع بالمشروع

RMDATA هو نظام إدارة داخلي لشركة الرداء الموحد. يدير:

- الفروع والمنشآت.
- الموظفين.
- الكيانات القانونية والضريبية.
- أصحاب العمل/الملاك/الشركاء.
- السكن.
- المركبات.
- الهواتف.
- المستندات.
- التنبيهات والانتهاءات.
- المستخدمين والصلاحيات.
- الأرشيف والسجلات.

التقنيات الأساسية:

- React + TypeScript + Vite + Tailwind.
- Electron لتطبيق سطح المكتب.
- SQLite للوضع المحلي.
- MySQL/MariaDB للوضع البعيد على VPS.
- Node.js/Express API.
- PHP API gateway موجود كمسار قديم/احتياطي.
- Expo/React Native موجود كمشروع موبايل أولي، لكنه ليس المسار الأساسي حالياً.

## 2. القرار الاستراتيجي الحالي

- لا نعيد كتابة المشروع من الصفر.
- لا ننتقل إلى Flutter الآن.
- نستمر على React/Electron.
- نجهز V2 عبر تنظيف الأساس أولاً.
- Node API يجب أن يصبح المسار الأساسي للوضع البعيد.
- PHP gateway يبقى legacy/fallback إن لزم.
- الموبايل لاحقاً يكون غالباً Expo/React Native بعد استقرار API.

## 3. ملفات التوثيق التي تم إنشاؤها

تم إنشاء الملفات التالية:

- `docs/RMDATA_MASTER_PLAN_2026.md`
  المرجع الأساسي الحالي لخطة الإصلاح والتطوير، ويحل محل الاعتماد المباشر على الخطط القديمة.

- `docs/project-review-v2-2026-05-13.md`  
  تقرير مراجعة شامل للمشروع، المخاطر، والتوصيات.

- `docs/project-brief-for-developers-ai.md`  
  شرح احترافي للبرنامج موجه للمبرمجين وأدوات الذكاء الاصطناعي.

- `docs/v2-repair-and-development-roadmap.md`  
  خطة إصلاح وتطوير للانتقال إلى V2.

- `AI_MEMORY.md`  
  هذا الملف، لتسجيل الجلسات والقرارات وما تم عمله.

## 4. نتائج الفحص الحالية

آخر فحص تم (2026-06-24):

- `npm run typecheck`: نجح (0 أخطاء).
- `npm run test:sqlite-mysql`: نجح (6/6).
- `node --check server/dev-api-server.js`: نجح.
- `node --check server/permissions-resolver.js` و`permission-middleware.js` و`permissions-catalog.js` و`routes/legacy-db-query.js`: نجح.
- `npm run build:react`: نجح.
- مقارنة كتالوج الصلاحيات TS↔JS: 170/170 متطابق (`permissionCatalogV2.ts` = `permissions-catalog.js`).

ملاحظات:

- المرحلة B (ثبات TypeScript) مكتملة؛ `typecheck` أخضر دون تعطيل `strict` أو `noUnusedLocals`.
- نظام الصلاحيات v4 شغال في الكود (انظر جلسة 2026-06-24)؛ بعض ملفات `docs/` ما زالت تصف النموذج القديم.
- إصدار التطوير المحلي: `1.4.2` (إصلاح قسم الضرائب/الكيانات — hooks order في `Entities.tsx`).

## 5. أولويات العمل القادمة

الأولوية 0:

- [x] إنشاء Git repo.
- [x] إنشاء remote private على GitHub.
- [x] عمل baseline commit.
- [x] رفع baseline إلى GitHub.
- [x] إضافة `SECURITY.md`.
- [x] إنشاء/رفع tag باسم `v1.4.1-baseline` حسب تأكيد المرحلة/ظهور tag.
- [x] أخذ backup من MySQL/files على السيرفر، مؤكد من صاحب المشروع أن النسخ تعمل.
- [x] توثيق الوضع الحالي في `docs/CURRENT_STATE_v1.4.1.md`.
- [x] إنشاء `docs/BACKUP_LOG.md`.

الأولوية 1:

- [x] إصلاح `npm run typecheck` (2026-05-21).
- [x] أخطاء runtime المحتملة في الملفات المستهدفة (مستندات، حالة موظف، أكواد RMO).
- [x] توحيد `DocumentListItem` في PhoneProfile و VehicleProfile.
- [x] ضبط `window.electronAPI` في عدة modals.
- لم يُعطَّل `strict` أو `noUnusedLocals`.

الأولوية 2:

- تقسيم الملفات الكبيرة.
- البدء بـ `server/dev-api-server.js`.
- ثم ملفات الواجهة الكبيرة مثل `AddBranchModal.tsx`, `BranchProfile.tsx`, `AddEmployeeModal.tsx`.

الأولوية 3:

- توحيد Node API.
- تقليل الاعتماد على `/api/db/query`.
- إبقاء PHP gateway كـ legacy/fallback.

## 6. قواعد العمل لأي AI أو مبرمج

1. لا تعدل ملفات:
   - `dist`
   - `dist-electron`
   - `release`
   - `release2`
   - `node_modules`
   - `api-gateway-php/vendor`

2. لا تغير قاعدة البيانات بدون:
   - backup قبل التعديل.
   - migration واضح.
   - اختبار بعد التعديل.

3. لا تضف ميزة كبيرة قبل إنهاء مرحلة الحماية وTypeScript.

4. لا تكسر Local mode أو Remote mode.

5. لا تعتمد على صلاحيات الواجهة فقط. أي عملية حساسة يجب أن تكون محمية في backend.

6. بعد كل جلسة عمل، حدّث هذا الملف في قسم "سجل الجلسات".

7. أي بند يُنجز في `docs/RMDATA_MASTER_PLAN_2026.md` يجب تعليمه بـ `[x]` في نفس الجلسة.

## 7. سجل الجلسات

### 2026-05-13 - مراجعة وتحضير V2

ما تم:

- فحص بنية المشروع.
- قراءة ملفات التشغيل والإعداد.
- تحديد أن المشروع يعمل كتطبيق Electron/React مع SQLite وAPI بعيد.
- تحديد وجود Node API وPHP gateway وMySQL/MariaDB.
- تشغيل فحوصات البناء والاختبار.
- إنشاء تقرير مراجعة شامل.
- إنشاء تقرير تعريفي للمبرمجين وأدوات AI.
- إنشاء خطة إصلاح وتطوير للانتقال إلى V2.
- إنشاء هذا الملف لتسجيل الذاكرة.

نتائج مهمة:

- `build:react` يعمل.
- `build:electron` يعمل.
- اختبار `sqlite-to-mysql` يعمل.
- `typecheck` لا يعمل ويجب إصلاحه.
- المشروع ليس Git repo حالياً.

قرارات:

- لا إعادة كتابة من الصفر.
- لا Flutter حالياً.
- الاستمرار على React/Electron.
- اعتماد Node API تدريجياً كمسار أساسي.
- البدء الأسبوع القادم بمرحلة الحماية: Git + Backup + توثيق.

الخطوة التالية:

- تنفيذ المرحلة 0 من `docs/v2-repair-and-development-roadmap.md`.

### 2026-05-21 - اعتماد خطة مرجعية جديدة

ما تم:

- مراجعة `docs/v2_review_report1.md`.
- مراجعة `docs/v2-repair-and-development-roadmap.md`.
- فحص الحالة الفعلية للكود مقابل الخطط القديمة.
- إنشاء `docs/RMDATA_MASTER_PLAN_2026.md` كمرجع رئيسي جديد.

نتائج مهمة:

- المرحلة 1 لم تبدأ فعلياً: جداول V2 غير موجودة في schema.
- `npm run typecheck` ما زال يفشل بأخطاء متعددة.
- Node API هو مسار التطوير الجديد.
- PHP Gateway يبقى Legacy فقط ولا تضاف له ميزات.
- `/api/db/query` يجب تشديده قبل بناء ميزات V2.

الخطوة التالية:

- بدء المرحلة B من الخطة الجديدة: إصلاح TypeScript وثبات البناء.

### 2026-05-13 - تجهيز .gitignore للمرحلة 0

ما تم:

- التأكد أن ملف `.gitignore` موجود لكنه مخفي لأنه يبدأ بنقطة.
- تعديل `.gitignore` حتى لا يدخل Git ملفات البناء والحزم والملفات الحساسة.
- إبقاء `package-lock.json` داخل Git لأنه مهم لتثبيت نسخ الحزم.
- إضافة تجاهل `api-gateway-php/vendor/`, `release2/`, `*.tsbuildinfo`, `.cursor/`, `.tmp-*`.

نتائج التحقق:

- `git status --short` يظهر ملفات المصدر فقط تقريباً.
- `git check-ignore` أكد تجاهل `node_modules`, `dist`, `dist-electron`, `release`, `release2`, `api-gateway-php/vendor`, `.env`, و`tsconfig.node.tsbuildinfo`.

الخطوة التالية:

- تنفيذ `git add .` ثم مراجعة `git status` قبل أول commit.

### 2026-05-13 - ملاحظة Git حول مجلد mobile

ما حدث:

- عند تنفيذ `git add .` فشل Git برسالة: `mobile/ does not have a commit checked out`.
- السبب أن مجلد `mobile/` يحتوي على `.git` داخلي، لذلك Git الرئيسي يحاول التعامل معه كـ submodule.

القرار المقترح:

- إزالة `mobile/.git` فقط، حتى يصبح `mobile` جزءاً عادياً من repository الرئيسي.
- لا نحذف ملفات الموبايل نفسها.
- تمت إضافة `.gitattributes` لضبط نهايات الأسطر وتقليل مشاكل LF/CRLF.

الخطوة التالية:

- حذف مجلد `mobile/.git` ثم إعادة `git add .`.

### 2026-05-13 - إضافة سياسة الأمان

ما تم:

- إنشاء ملف `SECURITY.md` في جذر المشروع.
- توضيح طريقة التعامل مع المشاكل الأمنية.
- توثيق الملفات والمعلومات التي يمنع رفعها إلى Git.
- توثيق الملفات الحساسة التي يجب تعديلها بحذر.

الخطوة التالية:

- إضافة الملف إلى Git في commit جديد أو تعديله ضمن baseline إذا لم يتم تثبيت baseline بعد.

### 2026-05-13 - تأكيد مسار GitHub ومبدأ عدم لمس النسخة المثبتة

ما تم:

- تم رفع المشروع إلى GitHub على: `https://github.com/khatib96/rmdata.git`.
- تمت إضافة `SECURITY.md` وظهر على GitHub.
- تمت ملاحظة لغات المشروع على GitHub: TypeScript هو الغالب، ثم JavaScript وPHP.
- تم الاتفاق أن النسخة المثبتة الحالية لا يتم لمسها مباشرة.

القرار:

- التطوير القادم يتم داخل Git على الكود.
- لا يتم التأثير على النسخة المثبتة عند المستخدمين إلا بعد build جديد واختبار ثم رفع release/update.
- أي مرحلة من الخطة يتم تعليمها بعلامة `[x]` عند إنجازها داخل `docs/v2-repair-and-development-roadmap.md` و/أو هذا الملف.

الخطوة التالية:

- التأكد من وجود tag baseline على GitHub.
- البدء بملفات backup والتوثيق: `docs/BACKUP_LOG.md` و`docs/CURRENT_STATE_v1.4.1.md`.

### 2026-05-13 - إكمال ملفات المرحلة 0

ما تم:

- إنشاء `docs/BACKUP_LOG.md`.
- إنشاء `docs/CURRENT_STATE_v1.4.1.md`.
- تحديث checklist في `docs/v2-repair-and-development-roadmap.md`.
- تسجيل أن backup السيرفر والتحديثات موجودة وتعمل حسب تأكيد صاحب المشروع.

القرار:

- المرحلة 0 تعتبر منجزة تقريباً من ناحية Git/GitHub/توثيق/Backup.
- المتبقي العملي الوحيد قبل المرحلة 1 هو تشغيل build بعد baseline إذا أردنا توثيق نتيجة حديثة.

الخطوة التالية:

- رفع ملفات المرحلة 0 إلى Git.
- بعدها نبدأ المرحلة 1: إصلاح `npm run typecheck`.

### 2026-05-13 - فحص السيرفر قراءة فقط

ما تم:

- تم الدخول إلى السيرفر عبر SSH:
  - user: `deploy`
  - host: `api.rmdata.tech`
- تم فحص معلومات النظام والموارد.
- تم فحص مسارات `/var/www/api.rmdata.tech`.
- تم فحص PM2 وNginx.
- تم فحص آخر logs لـ `rmdata-node-api`.
- تم تحديث `docs/CURRENT_STATE_v1.4.1.md`.
- تم تحديث `docs/BACKUP_LOG.md`.

نتائج مهمة:

- السيرفر: Ubuntu 24.04.4 LTS.
- Node.js: `v20.20.2`.
- npm: `10.8.2`.
- PM2: `6.0.14`.
- Nginx: active.
- API process: `rmdata-node-api`, online.
- API script: `/var/www/api.rmdata.tech/current/server/dev-api-server.js`.
- API cwd: `/var/www/api.rmdata.tech/current`.
- API port: `3001`.
- Storage root: `/var/www/api.rmdata.tech/storage`.
- Documents: `/var/www/api.rmdata.tech/storage/documents`.
- Images: `/var/www/api.rmdata.tech/storage/images`.

ملاحظات:

- السيرفر يحتاج restart حسب رسالة النظام، لكن لا يتم عمل reboot الآن بدون نافذة صيانة.
- يوجد 13 update متاح، ولا نطبقها الآن حتى لا نؤثر على الإنتاج.
- logs القديمة فيها خطأ `seedPermissionCatalog is not a function` بتاريخ 2026-04-12، لكن logs اللاحقة تظهر `Permission catalog seed: OK`.
- مسار `/var/www/api.rmdata.tech/public/updates/win` غير موجود.
- مسار التحديثات الفعلي المؤكد من ملفات السيرفر: `/var/www/api.rmdata.tech/html/updates`.

الخطوة التالية:

- رفع تحديثات التوثيق إلى Git.

### 2026-05-13 - إغلاق تحقق المرحلة 0

ما تم:

- تشغيل `npm run build:react` بعد baseline.
- تشغيل `npm run build:electron` بعد baseline.
- تحديث checklist في `docs/v2-repair-and-development-roadmap.md`.

نتائج التحقق:

- `npm run build:react`: نجح.
- `npm run build:electron`: نجح.
- ظهر تحذير Vite أن chunk رئيسي أكبر من 500KB، وهذا ليس فشلاً لكنه يدخل ضمن تحسينات لاحقة.
- ظهر تحذير حول `postcss.config.js` و`MODULE_TYPELESS_PACKAGE_JSON`، وهو ليس فشلاً.

ملاحظة:

- الأوامر فشلت داخل sandbox بسبب `EPERM` على `C:\Users\alkat`، ثم نجحت خارج sandbox.

القرار:

- المرحلة 0 مكتملة من ناحية Git/GitHub/توثيق/سيرفر/build.

الخطوة التالية:

- رفع تحديث `AI_MEMORY.md` و`docs/v2-repair-and-development-roadmap.md`.
- بدء المرحلة 1 لاحقاً: إصلاح `npm run typecheck`.

### 2026-05-21 - المرحلة B: إصلاح TypeScript

ما تم:

- إصلاح 51 خطأ TypeScript على دفعات (runtime، electronAPI، مستندات، أيقونات، unused).
- تعليم المرحلة B كبند مكتمل في `docs/RMDATA_MASTER_PLAN_2026.md`.
- تعليم الخطط القديمة كمراجع ثانوية وليست الخطة الحاكمة.
- إضافة استيراد `listDocuments` / `deleteDocumentById` في `HousingProfile.tsx`.
- توسيع `generateNextCode` لدعم بادئة `RMO` وجدول `employers`.
- توحيد أنواع الأيقونات (`LucideIcon | typeof TaxIcon`) في Sidebar و Services.
- تنظيف متغيرات/imports غير مستخدمة دون تغيير سلوك التطبيق.

الملفات الرئيسية التي تغيرت:

- `src/components/Housing/HousingProfile.tsx`
- `src/components/Employees/UpdateStatusModal.tsx`
- `src/components/Phones/PhoneProfile.tsx`, `AddPhoneModal.tsx`
- `src/components/Vehicles/VehicleProfile.tsx`
- `src/components/Entities/AddEntityModal.tsx`
- `src/components/Employers/*`, `src/components/Layout/Sidebar.tsx`
- `src/pages/Services.tsx`, `Archive.tsx`, `Documents.tsx`
- `src/utils/entityCode.ts`, `src/services/companyMessagesResolver.ts`

الأوامر التي شُغلت:

- `npm run typecheck`
- `npm run test:sqlite-mysql`
- `node --check server/dev-api-server.js`

نتائج التحقق:

- `npm run typecheck`: نجح.
- `npm run test:sqlite-mysql`: نجح (6 اختبارات).
- `node --check server/dev-api-server.js`: نجح.

الخطوة التالية:

- المرحلة C: تشديد `db/query` قبل V2. تقسيم الملفات الكبيرة يأتي لاحقاً في المرحلة G من الخطة الرئيسية.

### 2026-05-21 - المرحلة C: تشديد db/query - الدفعة الأولى

ما تم:

- إضافة حارس SQL محلي في Electron لمساري `db:query` و `runDbQueryInternal`.
- تشديد Node `/api/db/query` بحيث تصبح الكتابة مرفوضة افتراضياً إلا لجداول Legacy محددة.
- ربط mutations في Node بصلاحيات تقريبية حسب المجال بدلاً من السماح العام.
- إضافة logging واضح لأي mutation يمر عبر مسار `legacy-db-query`.
- إنشاء `docs/db_query_inventory_phase_c.md` لجرد نقاط الدخول والجداول المؤقتة.
- تعليم البنود المنجزة في `docs/RMDATA_MASTER_PLAN_2026.md`.

الخطوة التالية:

- تحويل العمليات الأعلى خطراً من `db/query` إلى REST endpoints، بدءاً من الصلاحيات/المستخدمين أو الأرشفة والحذف.

### 2026-05-21 - المرحلة C: تحويل حفظ صلاحيات المستخدم إلى API

ما تم:

- إضافة Node endpoints:
  - `GET /api/users/:id/permissions`
  - `PUT /api/users/:id/permissions`
- إضافة Electron IPC:
  - `permissions:getUserPermissions`
  - `permissions:setUserPermissions`
- تعديل `UserPermissionsSettings` لاستخدام API/IPC الجديد بدلاً من حذف/إدخال `user_permissions` مباشرة.
- تحديث `docs/db_query_inventory_phase_c.md`.

الخطوة التالية:

- تحويل مرشح خطر آخر من `db/query` إلى REST/IPC، مثل المستخدمين أو الأرشفة والحذف.

### 2026-05-21 - المرحلة C: تحويل أرشفة واسترجاع السجلات إلى API

ما تم:

- إضافة Node endpoints لأرشفة السجلات:
  - `POST /api/employees/:id/archive`
  - `POST /api/branches/:id/archive`
  - `POST /api/vehicles/:id/archive`
  - `POST /api/housing/:id/archive`
  - `POST /api/phones/:id/archive`
  - `POST /api/entities/:id/archive`
  - `POST /api/employers/:id/archive`
- إضافة Node endpoints لاسترجاع السجلات المؤرشفة:
  - `POST /api/employees/:id/restore`
  - `POST /api/branches/:id/restore`
  - `POST /api/vehicles/:id/restore`
  - `POST /api/housing/:id/restore`
  - `POST /api/phones/:id/restore`
  - `POST /api/entities/:id/restore`
  - `POST /api/employers/:id/restore`
- إضافة Electron IPC:
  - `archive:archive`
  - `archive:restore`
- تعديل بروفايلات الموارد الأساسية لاستخدام `archiveRecord` بدلاً من `UPDATE ... SET status = 'archived'` المباشر.
- تعديل `Archive` لاستخدام `archiveRestore` بدلاً من `UPDATE ... SET status = 'active'` المباشر، مع إبقاء fallback قديم فقط للتوافق.
- تحديث `docs/RMDATA_MASTER_PLAN_2026.md` و `docs/db_query_inventory_phase_c.md` بعلامات الإنجاز.

الخطوة التالية:

- تحويل مسار خطر آخر من `db/query`، والأولوية الآن: الحذف النهائي للسجلات أو إدارة المستخدمين أو الضرائب.

### 2026-05-22 - المرحلة C: تحويل الحذف النهائي للموارد الأساسية إلى API

ما تم:

- إضافة Node endpoints للحذف النهائي:
  - `DELETE /api/employees/:id/permanent`
  - `DELETE /api/branches/:id/permanent`
  - `DELETE /api/vehicles/:id/permanent`
  - `DELETE /api/housing/:id/permanent`
  - `DELETE /api/phones/:id/permanent`
  - `DELETE /api/entities/:id/permanent`
  - `DELETE /api/employers/:id/permanent`
- إضافة Electron IPC:
  - `archive:deletePermanent`
- تعديل بروفايلات الموارد الأساسية لاستخدام `archiveDeletePermanent` بدلاً من سلاسل `DELETE FROM ...` المباشرة.
- إبقاء تنظيف ملفات المستندات في الواجهة للهواتف والسكن قبل حذف السجل، حتى لا يتغير سلوك حذف الملفات.
- تحديث `docs/RMDATA_MASTER_PLAN_2026.md` و `docs/db_query_inventory_phase_c.md` بعلامات الإنجاز.

التحقق:

- `npm run typecheck` نجح.
- `.\node_modules\.bin\tsc.cmd -p electron --noEmit` نجح.
- `node --check server/dev-api-server.js` نجح.
- `npm run test:sqlite-mysql` نجح.
- `git diff --check` نجح.

الخطوة التالية:

- تحويل مسارات الضرائب والمدفوعات، ثم تقليل بقايا `employer:*` الخاصة بالإنشاء/التعديل والربط.

### 2026-05-22 - المرحلة C: إغلاق الضرائب وإزالة fallbacks القديمة

ما تم:

- إضافة `requireAnyPermission` في Node لاستخدام صلاحية بديلة عند الحاجة.
- جعل مسارات الضرائب في Node تقبل `settings.*` أو `entities.*` حسب نوع العملية.
- إضافة `PUT /api/tax/entity-branches/:entityId` لاستبدال ربط فروع الكيان داخل transaction.
- إضافة Electron/Browser API methods:
  - `taxPaymentCreate`
  - `taxPaymentDelete`
  - `taxEntityBranchesReplace`
- تعديل `EntityProfileTaxTabs` و `AddEntityModal` لإيقاف `INSERT/DELETE` المباشر على `tax_payments` و `tax_entity_branches`.
- إزالة `tax_payments` و `tax_entity_branches` من allowlist المؤقتة للكتابة عبر `dbQuery`.
- إضافة `PUT /api/employees/:id/status` و `employee:statusUpdate` وتحويل `UpdateStatusModal` بعيداً عن `UPDATE employees` و `INSERT/UPDATE status_history` المباشر.
- إزالة fallbacks القديمة من الأرشفة/الاسترجاع/الحذف النهائي في بروفايلات الموارد الأساسية و `Archive`.
- تعليم Phase C كمنجزة في `docs/RMDATA_MASTER_PLAN_2026.md`.

الأوامر التي شغلت:

- `npm run typecheck`
- `.\node_modules\.bin\tsc.cmd -p electron --noEmit`
- `node --check server/dev-api-server.js`
- `node --check server/permission-middleware.js`
- `npm run test:sqlite-mysql`
- `git diff --check`

نتائج التحقق:

- كل الفحوصات نجحت.
- لا توجد بقايا Phase C مفتوحة. بقايا `dbQuery` الواسعة في شاشات الإنشاء/التعديل تنتقل للمرحلة D/G لأنها ليست من مسارات Phase C عالية الخطورة المغلقة هنا.

الخطوة التالية:

- المرحلة D: تثبيت Node API كمسار التطوير الوحيد وبدء نقل بقايا العمليات الواسعة من `dbQuery` بدون إضافة أي شيء جديد إلى PHP.

### 2026-05-22 - المرحلة D: بداية Node-only وعزل legacy-db-query

ما تم:

- إنشاء `docs/node_api_endpoints_phase_d.md` لتثبيت قائمة Node endpoints الحالية.
- عزل مسار `POST /api/db/query` في `server/routes/legacy-db-query.js`.
- إبقاء عقد `/api/db/query` كما هو، مع تمرير نفس الحراس والصلاحيات والـ side effects من `dev-api-server.js`.
- تعليم بند جرد endpoints في Phase D كمنجز، وتعليم `legacy-db-query` كأول route معزول.

التحقق:

- `node --check server/dev-api-server.js`: نجح.
- `node --check server/routes/legacy-db-query.js`: نجح.

الخطوة التالية:

- الاستمرار في Phase D بتقسيم routes التالية حسب المجال أو نقل أول شاشة إنشاء/تعديل كبيرة إلى API صريح.

### 2026-06-24 - فحص شامل للمشروع + تأكيد الصلاحيات v4 + توثيق مشكلة الموقع على macOS

ما تم:

- فحص الكود مباشرة (وليس الاعتماد على الوثائق فقط) لتأكيد حالة الصلاحيات والمشروع.
- تأكيد أن نظام الصلاحيات v4 **شغال**: كتالوج 170 مفتاحاً، واجهة `UserPermissionsSettings` لكل الأقسام، `usePermissions` + حماية سيرفر على معظم REST.
- تأكيد إصلاح قسم الضرائب/الكيانات: ترتيب React Hooks في `Entities.tsx` (فحص الصلاحية بعد `useCallback`).
- توثيق فجوات متبقية: حقول دقيقة لغير الموظفين/الأفرع، mismatch `users.view` vs `settings.users.view` على API، `db/query` ما زال مستخدماً بكثافة.
- توثيق **مشكلة الموقع وأوقات الصلاة على macOS** كإصلاح مطلوب (انظر أدناه).

نتائج الصلاحيات (من الكود الفعلي):

| الطبقة | الحالة |
|--------|--------|
| كتالوج موحّد 170 مفتاح | ✅ `src/permissions/permissionCatalogV2.ts` = `server/permissions-catalog.js` |
| مزامنة DB عند الإقلاع | ✅ Electron `syncPermissionCatalog` + Node `seedPermissionCatalog` |
| واجهة إعدادات المستخدم | ✅ `UserPermissionsSettings.tsx` — 10 أقسام (موظفون، أفرع، سكن، مركبات، أصحاب عمل، هواتف، كيانات، مستندات، إعدادات، سجلات) |
| نموذج التقييم v4 | Admin (`roleId=1`) = كل المفاتيح؛ مستخدم عادي = `user_permissions` فقط |
| `role_permissions` | الجدول موجود لكن **غير مستخدم** في resolver v4؛ `RolesSettings` محذوف من قائمة الإعدادات |
| إخفاء القائمة الجانبية | ✅ `Sidebar` → `canSection(module)` |
| بث `permissions-changed` | ✅ عند الحفظ في `UserPermissionsSettings` (الوثائق القديمة تقول غير مفعّل — خطأ) |
| حماية REST | ✅ ~75 endpoint بـ `requirePermission` / `requireAnyPermission` |
| عمق UI | **كامل** للموظفين والأفرع (تبويب + حقل)؛ **جزئي** لباقي الأقسام (CRUD + تبويبات فقط، بدون field-level في UI) |

فجوات صلاحيات مؤكدة (للإصلاح لاحقاً):

- `GET /api/users` يطلب `users:view` بينما الكتالوج v4 يعرّف `settings:users.view`.
- لا REST CRUD لـ `entities` — الإنشاء/التعديل عبر `db/query`.
- GET endpoints لا تفلتر حقول حساسة (مثل الرواتب) — الاعتماد على الواجهة فقط.
- `permissions_gap_matrix.md` و`permissions_phaseA_checklist.md` تصف نموذج deny/role قديم — **لا تعكس v4**.

مشكلة الموقع وأوقات الصلاة على macOS (**مُحدَّث — انظر جلسة 1.4.6 أدناه**):

**الأعراض (قديمة):** في نسخة Mac، ويدجت أوقات الصلاة يعرض: «تعذر تحديد الموقع — يرجى تفعيل خدمة الموقع في إعدادات Windows».

**السبب الجذري (من الكود):**

1. `electron/ipc/settings-ipc.ts` → `get-windows-location` يعمل **فقط على Windows** (`process.platform !== 'win32'` → `NOT_WINDOWS`).
2. `src/utils/deviceLocation.ts` → بعد فشل Windows IPC يحاول `navigator.geolocation` — المسار الصحيح لـ macOS.
3. على Electron/macOS غالباً يفشل `navigator.geolocation` لأن:
   - لا يوجد ملف `entitlements` أو `NSLocationWhenInUseUsageDescription` في إعدادات البناء (`package.json` mac بدون entitlements).
   - قد لا يُمنح إذن الموقع لعملية Electron من macOS.
4. رسائل الخطأ في `PrayerTimesWidget.tsx` مكتوبة لـ Windows حتى على Mac (`إعدادات Windows` / `خدمة Windows`).
5. `useDeviceTracker.ts` يعتمد على نفس `resolveDeviceCoordinates()` — تتبع الأجهزة على Mac يتأثر بنفس المشكلة.

**الملفات المعنية:**

- `src/utils/deviceLocation.ts` — منطق تحديد الإحداثيات
- `src/components/Layout/PrayerTimesWidget.tsx` — ويدجت الصلاة + رسائل الخطأ
- `src/hooks/useDeviceTracker.ts` — heartbeat + GPS للأجهزة المتصلة
- `src/utils/lastKnownLocation.ts` — fallback من localStorage
- `electron/ipc/settings-ipc.ts` — `get-windows-location` (Windows فقط)
- `electron/main.ts` — معالجات إذن geolocation
- `package.json` → `build.mac` — يحتاج entitlements + Info.plist للموقع

**الإصلاح المقترح (لم يُنفَّذ بعد):** → **نُفِّذ لاحقاً في 1.4.4–1.4.6** (CoreLocation أصلي، بدون IP).

الأوامر التي شُغلت:

- `npm run typecheck`
- `npm run test:sqlite-mysql`
- `node --check server/*.js`
- `npm run build:react`
- مقارنة برمجية كتالوج TS↔JS (170/170)

قرارات:

- الوثائق في `docs/permissions_*` تحتاج تحديث لتطابق v4 — لا تعتمد عليها كمصدر حالة نهائية.
- لا نشر للسيرفر حتى إغلاق الإصلاحات المحلية (1.4.2 + الموقع على Mac عند الطلب).
- إصلاح الموقع على Mac مسار مستقل عن Phase D/V2 لكنه يؤثر على Dashboard وتتبع الأجهزة.

الخطوة التالية:

1. ~~إغلاق إصدار 1.4.2 (build electron + اختبار الضرائب).~~
2. ~~إصلاح الموقع على macOS (entitlements + IPC أو geolocation + رسائل مناسبة).~~ — انظر جلسة 2026-06-24 (إصلاح الموقع).
3. إصلاح `users.view` mismatch على API.
4. تطبيق field-level permissions للكيانات/باقي الأقسام.

### 2026-06-24 - إصلاح الموقع الجغرافي وأوقات الصلاة على macOS

ما تم:

- إنشاء `electron/device-location.ts`: مسار موحّد `get-device-location` — Windows عبر PowerShell، macOS عبر geolocation على النافذة الرئيسية مع انتظار جاهزية النافذة وإعادة محاولة.
- إضافة `electron/entitlements.mac.plist` و`entitlements.mac.inherit.plist` مع `com.apple.security.personal-information.location`.
- ربط entitlements في `package.json` → `build.mac`.
- تحديث `preload.ts` و`deviceLocation.ts` لاستخدام `getDeviceLocation` بدل `getWindowsLocation` فقط.
- إنشاء `src/utils/locationPlatform.ts` لرسائل خطأ مناسبة لـ macOS/Windows.
- تحديث `PrayerTimesWidget.tsx`: رسائل macOS صحيحة، حالة `fallback` لآخر موقع معروف.
- `useDeviceTracker.ts` يستفيد تلقائياً من `resolveDeviceCoordinates()` المحدّث.

الملفات التي تغيرت:

- `electron/device-location.ts` (جديد)
- `electron/entitlements.mac.plist` (جديد)
- `electron/entitlements.mac.inherit.plist` (جديد)
- `electron/ipc/settings-ipc.ts`
- `electron/preload.ts`
- `src/utils/deviceLocation.ts`
- `src/utils/locationPlatform.ts` (جديد)
- `src/components/Layout/PrayerTimesWidget.tsx`
- `src/types/electron.d.ts`
- `package.json`

الأوامر التي شُغلت:

- `npm run typecheck`
- `npx tsc -p electron --noEmit`

نتائج التحقق:

- TypeScript أخضر للواجهة وElectron.

ملاحظة للنشر على Mac:

- يجب **إعادة بناء DMG** (`npm run dist:mac`) حتى تُضمَّن entitlements وInfo.plist في الحزمة المثبتة.
- عند أول تشغيل بعد التثبيت: تفعيل الموقع من **إعدادات النظام ← الخصوصية والأمان ← خدمات الموقع ← RMDATA**.

الخطوة التالية:

- build DMG جديد واختبار أوقات الصلاة + تتبع الأجهزة على Mac فعلياً.

### 2026-06-24/25 - إصلاح الموقع على macOS (1.4.4 → 1.4.6) + التحديث الهوائي لـ Mac

**السياق:** على Mac كان الموقع يظهر مدينة خاطئة (حلوان — من IP) أو «غير متوفر» في الأجهزة المتصلة وأوقات الصلاة، رغم تفعيل صلاحية RMDATA في إعدادات النظام.

**ما تم:**

**1.4.4 — محاولة أولى (ثم تبين أن IP غير مقبول):**
- مساعد Swift منفصل + fallback عبر IP (`ipGeolocation.ts`).
- المستخدم رفض الاعتماد على IP — يريد GPS/خدمة الموقع فقط.

**1.4.5 — إزالة IP بالكامل:**
- حذف `src/utils/ipGeolocation.ts` وكل مسارات `approximate`/IP.
- ترتيب macOS: `navigator.geolocation` في الـ renderer ثم IPC.
- `lastKnownLocation.ts`: مفتاح جديد `rmdata_gps_location_v1` + مسح الذاكرة القديمة الخاطئة.
- `setupGeolocationPermissions()` على `session.defaultSession` + warm-up عند `did-finish-load`.
- إزالة مساعد Swift المنفصل (لا يرث صلاحية RMDATA.app).

**1.4.6 — الحل الجذري (CoreLocation أصلي):**
- **السبب التقني:** `navigator.geolocation` في Electron على macOS غالباً لا يفعّل CoreLocation ولا يظهر نافذة الإذن (مشكلة معروفة في Chromium/Electron).
- إنشاء `electron/macos-location-lib.swift` → يُجمَّع إلى `libRmdataLocation.dylib` (CoreLocation داخل عملية RMDATA).
- `electron/device-location.ts`: على Mac يستدعي الـ dylib عبر `koffi` في worker thread (لا يجمّد الواجهة)، ثم fallback Chromium.
- `electron/set-geolocation-flags.ts`: أعلام Chromium `MacCoreLocationBackend` و`LocationProviderManager:PlatformOnly`.
- `package.json`: `prebuild:mac` لـ swiftc، `extraResources` للـ dylib، `NSLocationAlwaysAndWhenInUseUsageDescription`.
- تبعية جديدة: `koffi`.
- ترتيب الـ renderer على Mac: **IPC أولاً** (native) ثم المتصفح.
- إصدار التطوير الحالي: **1.4.6**؛ DMG: `release/RMDATA-1.4.6-arm64.dmg`.

**التحديث الهوائي (Auto Update) على السيرفر:**

| المنصة | مسار VPS (داخل `html/updates/`) | ملف الفهرس |
|--------|-----------------------------------|------------|
| Windows | `win/` | `latest.yml` |
| macOS | `mac/` (يُنشأ جديداً) | `latest-mac.yml` |

من `release/` بعد `npm run dist:mac` يُرفع إلى `updates/mac/`:
- `latest-mac.yml`
- `RMDATA-x.x.x-arm64.dmg`
- `RMDATA-x.x.x-arm64.dmg.blockmap` (اختياري)

التحقق: `https://api.rmdata.tech/updates/mac/latest-mac.yml`

التطبيق يقرأ تلقائياً من `updates/mac` على darwin (`electron/main.ts` → `updaterPlatformSlug()`).

**الملفات التي تغيرت (1.4.4–1.4.6):**

- `electron/macos-location-lib.swift` (جديد)
- `electron/set-geolocation-flags.ts` (جديد)
- `electron/device-location.ts`
- `electron/main.ts`
- `src/utils/deviceLocation.ts`
- `src/utils/lastKnownLocation.ts`
- `src/utils/locationPlatform.ts`
- `src/components/Layout/PrayerTimesWidget.tsx`
- `package.json` / `package-lock.json`
- حُذف: `src/utils/ipGeolocation.ts`
- `.gitignore`: `electron/bin/` (مخرجات prebuild — لا تُرفع لـ git)

**الأوامر التي شُغلت:**

- `npm run typecheck`
- `npm run build:electron`
- `npm run prebuild:mac`
- `npm run dist:mac` → `RMDATA-1.4.6-arm64.dmg`

**نتائج التحقق:**

- TypeScript أخضر؛ الـ dylib مضمّن في `RMDATA.app/Contents/Resources/`.
- Info.plist يحتوي مفاتيح الموقع الثلاثة.
- اختبار الـ dylib من `node` مباشرة يعطي timeout (متوقع — ليس عملية RMDATA)؛ الاختبار الحقيقي على الجهاز بعد تثبيت DMG.

**قرارات:**

- **لا IP أبداً** لتحديد الموقع — GPS/CoreLocation/Wi‑Fi فقط.
- البناء الحالي **arm64 فقط** (Apple Silicon).
- لا نشر ملفات `release/` على git (في `.gitignore`) — تُرفع يدوياً/SFTP إلى VPS.
- `electron/bin/libRmdataLocation.dylib` يُبنى محلياً عند `prebuild:mac` ولا يُتتبَّع في git.

**مشاكل أو مخاطر:**

- أجهزة Mac Intel تحتاج بناء `x64` منفصل لاحقاً إن وُجدت.
- التحديث الهوائي على Mac يحمّل DMG؛ المستخدم يحتاج تأكيد التثبيت من «حول النظام».
- 1.4.6 يحتاج اختبار نهائي من المالك على الجهاز (موقع + أوقات صلاة + أجهزة متصلة).

**الخطوة التالية:**

1. تثبيت `RMDATA-1.4.6-arm64.dmg` واختبار الموقع على Mac.
2. رفع ملفات `release/` إلى `updates/mac/` على VPS.
3. commit + push للكود على GitHub.
4. إصلاح `users.view` mismatch؛ field-level permissions.

## 8. قالب تسجيل جلسة جديدة

عند نهاية كل جلسة، أضف مدخلاً بهذا الشكل:

```md
### YYYY-MM-DD - عنوان الجلسة

ما تم:

- ...

الملفات التي تغيرت:

- ...

الأوامر التي شُغلت:

- ...

نتائج التحقق:

- ...

قرارات:

- ...

مشاكل أو مخاطر:

- ...

الخطوة التالية:

- ...
```

## 9. الحالة الحالية المختصرة

الحالة: مشروع عامل؛ إصدار التطوير **1.4.6**؛ `typecheck` أخضر؛ Phase C مغلقة؛ الصلاحيات v4 شغالة (170 مفتاح، واجهة + سيرفر).
المرجع الحالي: `docs/RMDATA_MASTER_PLAN_2026.md`.
المرحلة القادمة: اختبار 1.4.6 على Mac → رفع `updates/mac/` على VPS → Phase D (Node API + تقليل `dbQuery`).
إصلاح الموقع على Mac: CoreLocation أصلي عبر `libRmdataLocation.dylib` (1.4.6) — بانتظار تأكيد المالك بعد تثبيت DMG.
التحديث الهوائي: `updates/win/` موجود؛ `updates/mac/` يحتاج إنشاء + رفع `latest-mac.yml` + DMG.
أهم خطر متبقٍ: `db/query` Legacy؛ GET API لا يفلتر حقول حساسة؛ `users.view` mismatch؛ بناء Mac arm64 فقط.
أهم قرار: Node فقط للميزات الجديدة، PHP Legacy، لا نشر VPS قبل اختبار محلي، لا V2 قبل migrations، **لا موقع عبر IP**.
