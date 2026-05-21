# AI_MEMORY - RMDATA System

آخر تحديث: 2026-05-21
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

آخر فحص تم (2026-05-21):

- `npm run typecheck`: نجح (0 أخطاء).
- `npm run test:sqlite-mysql`: نجح (6/6).
- `node --check server/dev-api-server.js`: نجح.

ملاحظة:

- المرحلة B (ثبات TypeScript) اكتملت من ناحية `typecheck` دون تعطيل `strict` أو `noUnusedLocals`.

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

الحالة: مشروع عامل على أساس v1.4.1؛ `typecheck` أخضر بعد المرحلة B.
المرجع الحالي: `docs/RMDATA_MASTER_PLAN_2026.md`.
المرحلة القادمة: المرحلة C - تشديد `db/query` قبل V2.
أهم خطر متبقٍ: `db/query` ما زال Legacy واسع الاستخدام.
أهم قرار: Node فقط للميزات الجديدة، وPHP Legacy، ولا بداية V2 قبل تشديد `db/query` وتنظيم migrations والصلاحيات.
