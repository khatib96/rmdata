# ملاحظة حالة

هذا الملف مرجع إصلاح سابق ومفيد للسياق، لكنه لم يعد الخطة الحاكمة الحالية. المرجع الأساسي للعمل من تاريخ 2026-05-21 هو `docs/RMDATA_MASTER_PLAN_2026.md`.

---

# خطة إصلاح وتطوير RMDATA للانتقال إلى V2

تاريخ الخطة: 2026-05-13  
الهدف: نقل النظام من نسخة عاملة لكن متراكمة تقنياً إلى أساس V2 مستقر، قابل للتطوير، ومناسب للويب والموبايل.

## 0. متابعة التقدم

آخر تحديث: 2026-05-13

### المرحلة 0: حماية المشروع وتثبيت الوضع الحالي

- [x] إنشاء/تأكيد `.gitignore` مناسب للمشروع.
- [x] إضافة `.gitattributes` لضبط نهايات الأسطر.
- [x] إنشاء Git repo محلي.
- [x] معالجة مشكلة `mobile/.git` حتى لا يظهر كمستودع داخلي/submodule.
- [x] تنفيذ baseline commit.
- [x] إنشاء repository خاص/مخصص على GitHub.
- [x] رفع baseline إلى GitHub.
- [x] إضافة `SECURITY.md`.
- [x] تحديث `AI_MEMORY.md`.
- [x] إنشاء tag باسم `v1.4.1-baseline` ورفعه إلى GitHub، حسب ظهور tag على GitHub/تأكيد المرحلة.
- [x] إنشاء `docs/BACKUP_LOG.md`.
- [x] أخذ backup من MySQL/MariaDB على VPS، مؤكد من صاحب المشروع أن نسخ السيرفر تعمل.
- [x] أخذ backup من ملفات المستندات والصور على السيرفر، مؤكد من صاحب المشروع أن نسخ السيرفر تعمل.
- [x] أخذ backup من SQLite المحلي إن كان مستخدماً في جهاز إنتاج، غير مطلوب حالياً حسب الاعتماد على السيرفر.
- [x] إنشاء `docs/CURRENT_STATE_v1.4.1.md`.
- [x] توثيق طريقة deploy الحالية بشكل مبدئي.
- [x] توثيق طريقة رفع تحديث جديد إلى `api.rmdata.tech/updates/win` بشكل مبدئي.
- [x] تشغيل `npm run build:react` بعد baseline.
- [x] تشغيل `npm run build:electron` بعد baseline.

### المرحلة 1: إصلاح TypeScript وثبات البناء

- [ ] تشغيل `npm run typecheck` وحفظ الأخطاء.
- [ ] إصلاح أخطاء runtime المحتملة.
- [ ] توحيد أنواع المستندات.
- [ ] إصلاح حالات `window.electronAPI` المحتملة.
- [ ] إصلاح أنواع الأيقونات المخصصة.
- [ ] تنظيف unused imports/locals.
- [ ] جعل `npm run typecheck` ينجح.

### المرحلة 2: ترتيب الملفات الكبيرة بدون تغيير السلوك

- [ ] تقسيم `server/dev-api-server.js`.
- [ ] تقسيم `electron/database/migrations.ts` أو تحييده تدريجياً.
- [ ] تقسيم `src/components/Branches/AddBranchModal.tsx`.
- [ ] تقسيم `src/components/Branches/BranchProfile.tsx`.
- [ ] تقسيم `src/components/Employees/AddEmployeeModal.tsx`.

### مبدأ الإصدارات

- [x] تثبيت القرار: النسخة المثبتة الحالية لا نلمسها مباشرة.
- [x] كل التطوير القادم يتم على الكود داخل Git.
- [ ] بعد الاختبار فقط يتم عمل build جديد.
- [ ] بعد build ناجح يتم إنشاء release/update جديد.
- [ ] لا يتم رفع تحديث للمستخدمين قبل التحقق من Local وRemote.

## 1. القرار العام

لا نعيد كتابة المشروع من الصفر، ولا ننتقل إلى Flutter الآن. القرار العملي هو:

- الحفاظ على النسخة الحالية لأنها تعمل ومرفوعة على VPS.
- تنظيف الأساس الهندسي قبل إضافة ميزات كبيرة.
- توحيد مسار البيانات تدريجياً حول Node API.
- إبقاء Electron كتطبيق سطح مكتب.
- تجهيز موبايل لاحقاً عبر Expo/React Native بعد استقرار API.

## 2. قواعد لا تكسر

1. كل مرحلة تنتهي والبرنامج يعمل.
2. لا ميزة كبيرة قبل إصلاح الأساس.
3. Git وBackup قبل أي تعديل جدي.
4. لا تغيير في قاعدة البيانات بدون migration ونسخة احتياطية.
5. لا تعتمد على إخفاء الواجهة فقط في الصلاحيات، السيرفر يجب أن يحمي أيضاً.
6. لا تعدل ملفات build مثل `dist`, `dist-electron`, `release` كمصدر.

## 3. المرحلة 0: حماية المشروع وتثبيت الوضع الحالي

المدة المقترحة: 3 إلى 5 أيام.

### الهدف

تثبيت نسخة v1 الحالية كنقطة رجوع آمنة قبل بدء التنظيف.

### المهام

1. إنشاء Git repo إذا لم يكن موجوداً:

```bash
git init
git add .
git commit -m "baseline: v1.4.1 working state before v2 cleanup"
git tag v1.4.1-baseline
```

2. التأكد من `.gitignore`:

يجب أن يستثني:

```text
node_modules/
dist/
dist-electron/
release/
release2/
api-gateway-php/vendor/
*.log
.env
.env.local
*.db
*.db-shm
*.db-wal
```

3. رفع المشروع إلى remote private:

- GitHub private.
- GitLab private.
- Bitbucket private.

4. أخذ نسخ احتياطية:

- MySQL/MariaDB من VPS.
- SQLite المحلي إن كان مستخدماً.
- مجلد المستندات والصور على السيرفر.
- مجلد المستندات المحلي من أجهزة مهمة إن وجد.

5. إنشاء ملف:

`docs/CURRENT_STATE_v1.4.1.md`

يحتوي:

- طريقة تشغيل المشروع محلياً.
- طريقة بناء نسخة Electron.
- طريقة نشر API على VPS.
- طريقة رفع التحديثات إلى `api.rmdata.tech/updates/win`.
- مسار قاعدة البيانات.
- مسار الملفات.
- إعدادات PM2/Nginx.
- أسماء الخدمات والمنافذ.

6. تنظيف مساحة العمل:

- انقل `release` و`release2` إلى أرشيف خارجي.
- احذف `dist` و`dist-electron` بعد التأكد من وجود Git/backup.
- لا تحذف أي شيء من الإنتاج.

### معيار النجاح

- `git log` يعمل.
- يوجد tag باسم `v1.4.1-baseline`.
- يوجد backup معروف التاريخ.
- يوجد توثيق CURRENT_STATE.
- `npm run build:react` ينجح.
- `npm run build:electron` ينجح.

## 4. المرحلة 1: إصلاح TypeScript وثبات البناء

المدة المقترحة: أسبوع إلى أسبوعين.

### الهدف

جعل المشروع يمر من:

```bash
npm run typecheck
```

بدون أخطاء.

### الوضع الحالي

البرنامج يبني بنجاح، لكن `typecheck` يفشل. هذا يعني أن هناك أخطاء أنواع قد تتحول إلى أخطاء runtime.

### ترتيب الإصلاح

#### أولوية 1: أخطاء قد تكسر التشغيل

أمثلة:

- دوال مفقودة مثل `listDocuments` و`deleteDocumentById`.
- استخدام `window.electronAPI` بدون فحص وجوده.
- props غير مدعومة على مكونات.
- أنواع callback لا تطابق المطلوب.

#### أولوية 2: توحيد أنواع المستندات

المشكلة المتكررة:

- `customName` أحياناً `string`.
- أحياناً `string | null`.
- أحياناً `string | null | undefined`.

الحل:

- اعتماد نوع واحد في `src/types/documents.ts`.
- استخدامه في كل ملفات المركبات، الهواتف، السكن، الموظفين، الفروع.

#### أولوية 3: أيقونات مخصصة مقابل Lucide

يوجد custom icons لا تطابق نوع `ForwardRefExoticComponent<LucideProps>`.

الحل:

- إما توحيد نوع icon prop ليقبل `React.ComponentType`.
- أو تغليف custom icons بواجهة توافقية.

#### أولوية 4: unused locals

احذف المتغيرات والـ imports غير المستخدمة، لكن لا تحذف كوداً وظيفياً معلّقاً قبل فهمه.

### ممنوع في هذه المرحلة

- ممنوع إطفاء `strict`.
- ممنوع إطفاء `noUnusedLocals`.
- ممنوع تعديل واسع غير متعلق بالأخطاء.

### معيار النجاح

- `npm run typecheck` ينجح.
- `npm run build:react` ينجح.
- `npm run build:electron` ينجح.
- لا توجد تغييرات سلوكية كبيرة.

## 5. المرحلة 2: ترتيب الملفات الكبيرة بدون تغيير السلوك

المدة المقترحة: أسبوعين إلى ثلاثة.

### الهدف

تقسيم الملفات الكبيرة حتى يصبح التطوير ممكناً بدون خوف من كسر النظام.

### الأولوية

1. `server/dev-api-server.js`
2. `electron/database/migrations.ts`
3. `src/components/Branches/AddBranchModal.tsx`
4. `src/components/Branches/BranchProfile.tsx`
5. `src/components/Employees/AddEmployeeModal.tsx`
6. `src/components/Employees/UpdateStatusModal.tsx`

### تقسيم Node API

الهيكل المقترح:

```text
server/
  app.js
  routes/
    auth.routes.js
    users.routes.js
    employees.routes.js
    branches.routes.js
    employers.routes.js
    housing.routes.js
    vehicles.routes.js
    phones.routes.js
    documents.routes.js
    settings.routes.js
    legacy-db-query.routes.js
  middleware/
    auth.middleware.js
    permissions.middleware.js
    error.middleware.js
  services/
    auth.service.js
    documents.service.js
    permissions.service.js
  db/
    mysql-db.js
    query-helpers.js
```

قاعدة التقسيم:

- لا تغير المنطق في نفس commit الذي تنقل فيه الكود.
- كل نقل يجب أن ينتهي بتشغيل build/tests.
- `/api/db/query` يوضع في ملف واضح باسم legacy.

### تقسيم مكونات الواجهة الكبيرة

مثال `AddBranchModal`:

```text
src/components/Branches/AddBranchModal/
  index.tsx
  types.ts
  hooks/
    useBranchForm.ts
    useBranchDocuments.ts
  sections/
    BasicInfoSection.tsx
    LocationSection.tsx
    LicenseSection.tsx
    LeaseSection.tsx
    DocumentsSection.tsx
```

قاعدة التقسيم:

- `index.tsx` يكون منسقاً فقط.
- hooks تحمل منطق التحميل والحفظ.
- sections تعرض الواجهة فقط.
- types موحدة في ملف واحد.

### معيار النجاح

- لا يوجد ملف واجهة أساسي فوق 30-40KB إلا باستثناء مبرر.
- `server/dev-api-server.js` لم يعد ملفاً ضخماً وحيداً.
- البرنامج يعمل كما كان قبل التقسيم.

## 6. المرحلة 3: توحيد أنواع البيانات والخدمات

المدة المقترحة: أسبوع إلى أسبوعين.

### الهدف

منع تكرار تعريف نفس الكيان بأشكال مختلفة.

### ملفات مقترحة

```text
src/types/
  auth.ts
  documents.ts
  query.ts
  entities.ts
  permissions.ts
```

### ما يجب توحيده

- `AuthUser`
- `QueryResult`
- `DocumentListItem`
- `Employee`
- `Branch`
- `Employer`
- `Entity`
- `Permission`

### ملاحظة

لا تنقل كل الأنواع دفعة واحدة. ابدأ بالأنواع التي تسبب أخطاء typecheck، ثم وسع تدريجياً.

## 7. المرحلة 4: ترتيب قاعدة البيانات والمهاجرات

المدة المقترحة: أسبوعين.

### الهدف

إيقاف الفوضى بين SQLite migrations وMySQL SQL files.

### الوضع الحالي

يوجد:

- `electron/database/migrations.ts`
- `src/database/migrations/*`
- `database/mysql-schema-rmdata.sql`
- `database/mysql-migrate-*.sql`

### الخطة

1. توثيق الوضع الحالي أولاً.
2. إنشاء جدول `schema_migrations` في SQLite وMySQL.
3. تقسيم migrations الجديدة فقط إلى ملفات مرقمة.
4. عدم محاولة إعادة كتابة كل migrations القديمة مرة واحدة.

الهيكل المقترح للمستقبل:

```text
database/migrations/
  sqlite/
    001_add_schema_migrations.sql
    002_permissions_v2.sql
  mysql/
    001_add_schema_migrations.sql
    002_permissions_v2.sql
```

### قاعدة مهمة

لا تحول كامل migration system دفعة واحدة. هذا خطر. الأفضل:

- اجعل القديم كما هو للنسخ الموجودة.
- كل تغيير جديد من الآن يكون migration مرقم.

## 8. المرحلة 5: توحيد المعمارية حول Node API

المدة المقترحة: 4 إلى 6 أسابيع.

### الهدف

Remote mode يجب أن يعتمد على Node API كمسار أساسي، وليس raw SQL من الواجهة.

### الوضع المستهدف

```text
React/Electron
  ↓
Services typed API client
  ↓
Node API on VPS
  ↓
MySQL/MariaDB
```

### ماذا يحدث لـ SQLite؟

يبقى SQLite للنسخة المحلية فقط أو لاحقاً offline cache، لكن مصدر الحقيقة في الوضع البعيد هو MySQL على VPS.

### ماذا يحدث لـ PHP gateway؟

القرار المقترح:

- إذا Node مستقر على VPS: PHP يصبح legacy/fallback.
- لا تضف ميزات v2 جديدة في PHP.
- أي mutation حساسة يجب أن تمر من Node.

### ماذا يحدث لـ `/api/db/query`؟

لا نحذفه مباشرة. نضعه في Legacy Mode:

- Logging لكل استدعاء.
- تحذير في dev console.
- حصر الصلاحيات عليه.
- منع mutations الحساسة تدريجياً.
- استبداله endpoints محددة module by module.

## 9. المرحلة 6: REST API حقيقي لكل قسم

المدة المقترحة: 4 أسابيع.

### Endpoints مطلوبة

#### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

#### Users & Permissions

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`
- `GET /api/permissions`
- `PUT /api/users/:id/permissions`

#### Employees

- `GET /api/employees`
- `GET /api/employees/:id`
- `POST /api/employees`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`
- `POST /api/employees/:id/status`
- `GET /api/employees/:id/documents`

#### Branches

- `GET /api/branches`
- `GET /api/branches/:id`
- `POST /api/branches`
- `PUT /api/branches/:id`
- `DELETE /api/branches/:id`
- `GET /api/branches/:id/employees`
- `GET /api/branches/:id/documents`

#### Documents

- `POST /api/documents/upload`
- `GET /api/documents`
- `GET /api/documents/:id`
- `GET /api/documents/:id/open`
- `DELETE /api/documents/:id`

#### Housing / Vehicles / Phones / Employers / Entities

نفس نمط CRUD مع endpoints فرعية للمستندات والعلاقات.

### لكل endpoint يجب وجود

- Auth middleware.
- Permission middleware.
- Input validation.
- Audit log للعمليات الحساسة.
- Error response موحد.
- Test على الأقل للمسارات الحساسة.

## 10. المرحلة 7: الاختبارات

المدة المقترحة: أسبوعين كبداية.

### الهدف

اختبارات قليلة لكنها تحمي الأشياء الخطرة.

### اختبارات مطلوبة أولاً

1. `sqlite-to-mysql`
2. `permissions-resolver`
3. auth login.
4. password change.
5. documents upload/delete.
6. employees create/update.
7. permission update.
8. path security للملفات.

### معيار النجاح

- 20 اختبار مبدئي ناجح.
- تشغيلها بأمر واضح.
- لا merge لأي تغيير حساس بدون نجاح الاختبارات.

## 11. بعد الإصلاح: ميزات V2 المقترحة

بعد انتهاء المراحل السابقة، يبدأ تطوير V2 الحقيقي.

### 11.1 تقارير احترافية

أفكار:

- تقرير الموظفين حسب الفرع.
- تقرير الانتهاءات القادمة خلال 30/60/90 يوم.
- تقرير السكن والساكنين.
- تقرير المركبات والتأمينات.
- تقرير المستندات الناقصة.
- تصدير PDF وExcel.

### 11.2 صلاحيات أدق

أفكار:

- صلاحيات حسب الفرع.
- صلاحيات حسب الحقل.
- إخفاء الرواتب أو تفاصيل العقود حسب المستخدم.
- صلاحيات رفع/حذف مستندات منفصلة.
- سجل تدقيق لتغيير الصلاحيات.

### 11.3 نظام طلبات وموافقات

أمثلة:

- طلب إجازة.
- طلب سلفة.
- طلب تعديل بيانات موظف.
- طلب رفع مستند.
- طلب اعتماد عقد أو دفعة.

النظام يكون configurable:

- نوع الطلب.
- من يوافق.
- هل يحتاج موافقة واحدة أو أكثر.
- سجل كامل للحالة.

### 11.4 إشعارات فورية

باستخدام WebSocket:

- تنبيه عند انتهاء مستند.
- تنبيه عند طلب جديد.
- تنبيه عند موافقة/رفض.
- تحديث مركز التنبيهات بدون refresh.

### 11.5 تطبيق موبايل

بعد استقرار API:

- Expo/React Native.
- تسجيل دخول.
- عرض بيانات الموظف.
- عرض التنبيهات.
- رفع مستندات وصور.
- طلبات وموافقات.
- Push notifications.

### 11.6 Dashboard v2

لوحة تحكم أفضل:

- مؤشرات حسب الفرع.
- بطاقات انتهاء قريبة.
- نشاط آخر 7 أيام.
- رسوم بيانية.
- فلترة حسب الفرع/الكيان.

### 11.7 البحث العام

بحث موحد في:

- موظفين.
- فروع.
- مركبات.
- هواتف.
- مستندات.
- أصحاب عمل.

### 11.8 تحسين المستندات

- Tags للمستندات.
- أنواع مستندات ثابتة.
- حالة مستند: صالح، منتهي، مفقود، يحتاج مراجعة.
- OCR لاحقاً لاستخراج تواريخ من المستندات.

## 12. جدول زمني واقعي

| المرحلة | المدة | الناتج |
|---|---:|---|
| 0. حماية وتوثيق | 3-5 أيام | Git + backup + current state |
| 1. TypeScript | 1-2 أسبوع | typecheck أخضر |
| 2. تقسيم الملفات | 2-3 أسابيع | ملفات قابلة للصيانة |
| 3. توحيد الأنواع | 1-2 أسبوع | types مستقرة |
| 4. migrations | 2 أسبوع | طريقة منظمة للتغييرات القادمة |
| 5. توحيد Node API | 4-6 أسابيع | Remote mode أكثر أماناً |
| 6. REST endpoints | 4 أسابيع | تقليل raw SQL |
| 7. اختبارات | 2 أسبوع | حماية المسارات الحرجة |

المدة الكلية الواقعية: 3 إلى 4 أشهر إذا كان العمل منتظماً.

## 13. أول أسبوع عملي بالتفصيل

### اليوم 1

- إنشاء Git repo.
- تثبيت `.gitignore`.
- أول commit.
- tag للنسخة الحالية.

### اليوم 2

- backup MySQL.
- backup files/storage.
- backup SQLite إن وجد.
- إنشاء `docs/BACKUP_LOG.md`.

### اليوم 3

- كتابة `docs/CURRENT_STATE_v1.4.1.md`.
- توثيق طريقة deploy.
- توثيق update flow.

### اليوم 4

- تنظيف مجلدات build/release من working tree.
- تشغيل build.
- commit.

### اليوم 5

- تشغيل `npm run typecheck`.
- حفظ الأخطاء في ملف مؤقت.
- تصنيف الأخطاء.
- البدء بأخطاء runtime المحتملة.

## 14. Prompts جاهزة لأداة AI

### Prompt 1: إصلاح TypeScript بدون تغيير السلوك

```text
أنت تعمل على مشروع RMDATA. المطلوب إصلاح أخطاء TypeScript فقط بدون تغيير سلوك البرنامج. لا تعدل ملفات dist/release. شغل npm run typecheck، صنف الأخطاء، وابدأ بالأخطاء التي قد تسبب runtime bugs. اعمل تغييرات صغيرة، وبعد كل مجموعة شغل npm run typecheck. لا تطفئ strict أو noUnusedLocals.
```

### Prompt 2: تقسيم ملف كبير

```text
أنت تعمل على مشروع RMDATA. المطلوب تقسيم الملف [اسم الملف] إلى ملفات أصغر بدون تغيير المنطق أو السلوك. لا تضف ميزات جديدة. استخرج الأنواع إلى types.ts، والمنطق إلى hooks/services، والواجهة إلى sections/components. بعد التقسيم شغل npm run typecheck و npm run build:react أو build:electron حسب الملف.
```

### Prompt 3: تحويل raw SQL إلى endpoint

```text
أنت تعمل على مشروع RMDATA. المطلوب تحويل عملية واحدة من dbQuery raw SQL إلى REST endpoint في Node API. أضف route/controller/service، طبّق requirePermission، أضف validation، وعدل service في الواجهة لاستخدام endpoint الجديد. أبق dbQuery القديم كfallback مؤقت إذا لزم. أضف اختباراً للمسار الجديد.
```

## 15. تقييم خطة Claude

الخطة التي أعطاها Claude صحيحة في الاتجاه العام، خصوصاً:

- Git أولاً.
- Backup قبل التعديل.
- إصلاح TypeScript قبل الميزات.
- تقسيم الملفات الكبيرة.
- تقليل `/api/db/query`.
- اعتبار PHP legacy إذا استقر Node.

لكن تحتاج تعديلين مهمين:

1. لا تبدأ بنظام migrations كامل دفعة واحدة. هذا خطر على مشروع يعمل في الإنتاج. ابدأ بتوثيق القديم، وكل migrations الجديدة فقط تكون مرقمة.
2. لا تجعل شرط “لا يوجد ملف فوق 30KB” صارماً جداً من أول شهر. اعتبره هدفاً تدريجياً، لأن بعض الملفات تحتاج تقسيم على أكثر من خطوة حتى لا ينكسر البرنامج.

## 16. الخلاصة

الطريق الصحيح إلى V2 ليس إعادة كتابة، بل:

1. حماية المشروع.
2. إصلاح TypeScript.
3. تقسيم الملفات الكبيرة.
4. توحيد الأنواع.
5. تنظيم migrations.
6. جعل Node API المسار الأساسي.
7. تقليل raw SQL.
8. إضافة اختبارات.
9. بعدها تبدأ ميزات V2 الفعلية.

بهذا الشكل تنتقل إلى V2 على أساس قوي، وتستفيد من كل العمل الموجود بدل رميه وإعادة بنائه من الصفر.
