# RMDATA Master Repair and Development Plan

آخر تحديث: 2026-05-21

هذه الوثيقة هي المرجع العملي الأساسي لخطة إصلاح وتطوير RMDATA. عند التعارض بينها وبين الخطط القديمة، هذه الوثيقة هي المعتمدة. الملفات القديمة تبقى كمراجع تفصيلية وأرشيف قرار، وليست مصدر حالة نهائية.

## 1. الهدف التنفيذي

الهدف ليس إعادة كتابة النظام من الصفر. الهدف هو نقل RMDATA من نسخة عاملة لكن متراكمة تقنياً إلى منصة تشغيل يومية ثابتة تعتمد على Node API وMariaDB، وتدعم لاحقاً الموبايل، الحضور، المبيعات، الطلبات، التنبيهات، التقارير، والدردشة الداخلية.

القاعدة الحاكمة: لا نضيف V2 فوق أساس غير مستقر. نصلح الأساس أولاً، ثم نبني الميزات الجديدة بواجهات API محمية وصريحة.

## 2. المراجع وحالتها

| الملف | الحالة |
|---|---|
| `docs/RMDATA_MASTER_PLAN_2026.md` | المرجع الأساسي الحالي |
| `AI_MEMORY.md` | ذاكرة مختصرة، يجب أن تشير إلى هذه الوثيقة |
| `docs/v2_review_report1.md` | مرجع أفكار وتفاصيل V2، لكنه مختلط زمنياً |
| `docs/v2-repair-and-development-roadmap.md` | مرجع إصلاح قريب من الواقع، لكنه يحتاج دمج مع حالة مايو |
| `docs/permissions_rearchitecture_review.md` | مرجع تصميم الصلاحيات المتقدم |
| `docs/permissions_phaseA_checklist.md` | مرجع ما تم وما لم يتم في مرحلة الصلاحيات |
| `docs/db_query_inventory_phase_c.md` | جرد مرحلة C لمسارات `db/query` والجداول المؤقتة |
| `docs/CURRENT_STATE_v1.4.1.md` | مرجع تشغيل VPS والحالة المنشورة |
| `docs/SYSTEM_EVOLUTION_PLAN.md` | أرشيف أفكار قديم |

## 3. الحقيقة الحالية من الكود

### 3.1 ما يعمل حالياً

- التطبيق: Electron + React + TypeScript + Vite + Tailwind.
- سطح المكتب هو المنتج الأساسي الحالي.
- Node/Express API موجود ويعمل كمسار رئيسي متقدم على VPS.
- MariaDB على VPS هي مصدر الحقيقة للوضع البعيد.
- SQLite موجود للوضع المحلي فقط.
- PHP Gateway موجود، لكنه Legacy ويجب عدم إضافة ميزات جديدة إليه.
- Git موجود والـ working tree نظيف عند آخر فحص.
- `npm run test:sqlite-mysql` ناجح.
- `node --check` لملفات السيرفر الأساسية ناجح.

### 3.2 ما لا يعمل أو لا يكتمل

- `npm run typecheck` يفشل بأخطاء TypeScript متعددة، وليس خطأ tsconfig واحد.
- جداول V2 غير موجودة في schema الفعلي.
- `database/migrations/` غير موجود كنظام migrations مرقم للمستقبل.
- `server/dev-api-server.js` ما زال ملفاً ضخماً ومركزياً.
- ملفات واجهة أساسية كبيرة جداً: `AddBranchModal.tsx`, `BranchProfile.tsx`, `AddEmployeeModal.tsx`.
- `/api/db/query` ما زال Legacy خطر: محمي جزئياً للكتابة، لكنه يسمح بقراءات واسعة ولا يغطي كل الجداول.
- مسار `db:query` المحلي في Electron لا يستخدم نفس حارس SQL بشكل كامل.
- كتالوج الصلاحيات مكرر بين السيرفر والواجهة، وهذا قابل للانحراف.
- الموبايل داخل `mobile/` هو Expo template ولم يبدأ فعلياً.

### 3.3 الملفات الكبيرة ذات الأولوية

| الملف | الحجم التقريبي | الأولوية |
|---|---:|---|
| `server/dev-api-server.js` | 89 KB / 2053 سطر تقريباً | عالية جداً |
| `src/components/Branches/AddBranchModal.tsx` | 80 KB / 1550 سطر تقريباً | عالية |
| `src/components/Branches/BranchProfile.tsx` | 77 KB / 1392 سطر تقريباً | عالية |
| `src/components/Employees/AddEmployeeModal.tsx` | 61 KB / 966 سطر تقريباً | عالية |
| `electron/database/migrations.ts` | 45 KB / 916 سطر تقريباً | متوسطة عالية |

## 4. قواعد العمل غير القابلة للكسر

1. لا تعدل `dist`, `dist-electron`, `release`, `node_modules`, أو `api-gateway-php/vendor`.
2. لا تضف أي endpoint جديد في PHP.
3. أي ميزة جديدة يجب أن تمر عبر Node API.
4. أي endpoint جديد يجب أن يستخدم `requireAuth` و `requirePermission` من اليوم الأول.
5. لا تغيير قاعدة بيانات بدون backup وملف migration مرقم.
6. كل مرحلة يجب أن تنتهي والبرنامج قابل للتشغيل محلياً وبعيداً.
7. لا تعطيل لـ `strict`, `noUnusedLocals`, أو `noUnusedParameters` لحل typecheck.
8. لا تعتمد على إخفاء واجهة فقط؛ السيرفر هو خط الدفاع الأساسي.
9. `db/query` Legacy فقط، ولا يستخدم في ميزات جديدة.
10. الموبايل لا يبدأ كمنتج فعلي قبل استقرار Node API وجداول V2 الأساسية.

## 5. المعمارية المستهدفة

```text
Desktop React/Electron
  -> Typed API Client
  -> Node API on VPS
  -> MariaDB

Mobile Expo
  -> Same Typed API Contract
  -> Node API on VPS
  -> MariaDB

WebSocket / Push
  -> Node API events
  -> DB-backed notifications and sync

SQLite
  -> Local/offline mode only
  -> No remote source of truth

PHP Gateway
  -> Legacy read-only/fallback until retired
  -> No V2 work
```

## 6. الخطة المرحلية المعتمدة

قاعدة التتبع: أي بند يكتمل يجب أن يتحول من `[ ]` إلى `[x]` في هذه الوثيقة، ويُضاف سطر مختصر في `AI_MEMORY.md` عند نهاية الجلسة.

## المرحلة A - توحيد المرجع والحالة

المدة: يوم إلى يومين.

الهدف: منع أي AI أو مبرمج من العمل على خطة متناقضة.

المهام:

- [x] اعتماد هذه الوثيقة كمرجع رئيسي.
- [x] تحديث `AI_MEMORY.md` ليشير إلى هذه الوثيقة.
- [x] تعليم الخطط القديمة كأرشيف أو مرجع تفصيلي غير حاكم.
- [x] توثيق آخر نتائج الفحص: `typecheck`, `test:sqlite-mysql`, `node --check`.
- [x] إنشاء سجل قرار قصير: Node هو المسار الجديد، PHP Legacy، `db/query` Legacy.

معيار النجاح:

- أي شخص يفتح المشروع يعرف أن البداية من هذه الوثيقة.
- لا توجد حالة تقول "Phase 1 جاهزة" بينما `typecheck` أحمر.

## المرحلة B - إصلاح TypeScript وثبات البناء

الحالة: مكتملة بتاريخ 2026-05-21.

المدة: أسبوع إلى أسبوعين.

الهدف: جعل `npm run typecheck` ينجح بدون تعطيل الصرامة.

مهام الإغلاق:

- [x] تشغيل `npm run typecheck` وجرد الأخطاء.
- [x] إصلاح أخطاء runtime المحتملة.
- [x] إصلاح حالات `window.electronAPI` التي قد تكون undefined.
- [x] توحيد أنواع المستندات في الملفات المتأثرة.
- [x] إصلاح توافق أيقونات Lucide/custom icons.
- [x] تنظيف unused imports/locals دون تعطيل `noUnusedLocals`.
- [x] التحقق النهائي عبر `npm run typecheck`.
- [x] التحقق عبر `npm run test:sqlite-mysql`.
- [x] التحقق عبر `node --check server/dev-api-server.js`.

معيار النجاح:

- `npm run typecheck` ينجح.
- `npm run test:sqlite-mysql` ينجح.
- `node --check server/dev-api-server.js` ينجح.
- لا تغييرات سلوكية كبيرة في هذه المرحلة.

## المرحلة C - تشديد `db/query` قبل V2

المدة: أسبوع إلى أسبوعين.

الهدف: إغلاق أخطر باب تقني قبل إضافة الحضور والمبيعات والطلبات.

المهام:

- [x] توحيد حارس SQL بين:
  - Node `/api/db/query`
  - Electron local `db:query`
  - أي utility داخلي يستخدم SQL خام
- [x] جعل `db/query` للقراءة فقط افتراضياً.
- [x] منع mutations عبر `db/query` إلا بقائمة صريحة مؤقتة ومحمية.
- [x] إضافة logging لكل mutation يمر من `db/query`.
- [x] جرد كل استخدامات `window.electronAPI.dbQuery` في الواجهة.
- [ ] تحويل أكثر العمليات خطورة إلى REST endpoints.
  - [x] حفظ صلاحيات المستخدمين عبر API/IPC صريح.
  - [x] أرشفة واسترجاع السجلات عبر API/IPC صريح.
  - [x] الحذف النهائي للموارد الأساسية عبر API/IPC صريح.
  - [ ] إدارة المستخدمين، الضرائب والمدفوعات.
- [x] وضع تحذير واضح في الكود أن `db/query` Legacy.

سياسة مؤقتة مقترحة:

- `SELECT/WITH`: مسموح مؤقتاً للمستخدم المصادق، مع قيود لاحقة حسب الصلاحيات.
- `INSERT/UPDATE/DELETE`: مرفوض افتراضياً، ويسمح فقط عبر allowlist مؤقتة.
- جداول حساسة مثل users, permissions, employees, documents, payments, requests لا تكتب إلا عبر REST.

معيار النجاح:

- لا توجد ميزة جديدة تستخدم `db/query`.
- كل mutation حساسة تمر من endpoint صريح.
- PHP `/db/query` لا يدخل في أي مسار جديد.

## المرحلة D - Node API فقط وترك PHP تدريجياً

المدة: أسبوعان إلى أربعة.

الهدف: تحويل Node إلى المصدر الوحيد للميزات والتطوير، وترك PHP كمسار قديم حتى الإزالة.

المهام:

- [ ] تثبيت قائمة endpoints التي تخدمها Node حالياً.
- [ ] إنشاء `server/app.js` أو `server/src/app.js` كنقطة تنظيم.
- [ ] تقسيم routes حسب المجال:
  - `auth`
  - `users`
  - `permissions`
  - `documents`
  - `branches`
  - `employees`
  - `employers`
  - `housing`
  - `vehicles`
  - `phones`
  - `settings`
  - `tax`
  - `legacy-db-query`
- [ ] توحيد response shape للأخطاء والنجاح.
- [ ] إضافة validation لكل endpoint جديد أو منقول.
- [ ] عدم حذف PHP فوراً؛ يتم تجميده فقط.
- [ ] إعداد مرحلة لاحقة في Nginx لإزالة fallback تدريجياً بعد الاختبار.

معيار النجاح:

- أي تطوير جديد يذهب إلى Node فقط.
- PHP لا يحتوي أي كود V2.
- `/api/db/query` معزول في ملف واضح باسم legacy.

## المرحلة E - الصلاحيات والأمان

المدة: أسبوعان إلى أربعة.

الهدف: أن يكون V2 مبنياً على صلاحيات سيرفرية حقيقية، لا واجهة فقط.

المهام:

- [ ] جعل Permission Catalog مصدراً واحداً، أو إضافة اختبار يمنع انحراف كتالوج السيرفر والواجهة.
- [ ] توسيع الصلاحيات لمجالات V2:
  - `attendance`
  - `schedules`
  - `sales`
  - `requests`
  - `admin_notifications`
  - `device_bindings`
  - `chat`
  - `reports`
- [ ] دعم صلاحيات حسب الفرع تدريجياً.
- [ ] دعم field-level masking للبيانات الحساسة:
  - الرواتب
  - العقود
  - الوثائق المالية
  - بيانات الهوية
- [ ] إضافة audit واضح لتغييرات الصلاحيات.
- [ ] إضافة endpoint لقراءة audit logs حسب الصلاحية.
- [ ] تثبيت `permissionVersion` وإبطال الكاش عند أي تغيير.

القاعدة:

- Admin roleId=1 يملك كل شيء.
- المستخدم العادي يملك فقط الصلاحيات الصريحة أو الصلاحيات الناتجة من نموذج متفق عليه.
- أي توسيع لنموذج role/branch/temporary permissions يجب أن يكون موثقاً قبل التطبيق.

معيار النجاح:

- لا endpoint حساس بدون `requirePermission`.
- لا اختلاف بين catalog السيرفر والواجهة.
- تغيير صلاحية يظهر في audit ويفرغ الكاش.

## المرحلة F - تنظيم قاعدة البيانات والمهاجرات

المدة: أسبوعان.

الهدف: من الآن فصاعداً كل تغيير DB يكون قابل للتتبع والتراجع.

الهيكل المعتمد:

```text
database/migrations/
  mysql/
    001_create_schema_migrations.sql
    002_create_attendance_records.sql
  sqlite/
    001_create_schema_migrations.sql
    002_create_attendance_records.sql
```

المهام:

- [ ] إنشاء `schema_migrations` في MariaDB وSQLite.
- [ ] عدم إعادة كتابة كل migrations القديمة دفعة واحدة.
- [ ] جعل كل migration جديد مرقماً ومنفصلاً.
- [ ] إضافة اختبار أو سكربت تحقق أن migration لم يطبق مرتين.
- [ ] توثيق rollback يدوي لكل migration حساس.
- [ ] إضافة schema parity check بين MariaDB وSQLite للجداول المشتركة.

معيار النجاح:

- لا يوجد `ALTER TABLE` عشوائي في سكربت عام لميزة جديدة.
- كل جدول V2 له migration مستقل.
- يمكن معرفة ماذا طبق على أي بيئة.

## المرحلة G - تقسيم الملفات الكبيرة بدون تغيير السلوك

المدة: أسبوعان إلى ثلاثة.

الهدف: تخفيف المخاطر قبل إضافة ميزات كبيرة.

### G1 - تقسيم السيرفر

الهيكل المستهدف:

```text
server/
  app.js
  server.js
  routes/
  middleware/
  services/
  db/
  validators/
  websocket/
  legacy/
```

قواعد التقسيم:

- النقل أولاً، لا تغيير منطق في نفس الخطوة.
- كل route ينتقل مع اختبار smoke.
- `legacy-db-query` يبقى واضحاً ومعزولاً.

### G2 - تقسيم الواجهة

مثال:

```text
src/components/Branches/AddBranchModal/
  index.tsx
  types.ts
  hooks/
  sections/
  services/
```

الأولوية:

1. `AddBranchModal.tsx`
2. `BranchProfile.tsx`
3. `AddEmployeeModal.tsx`
4. `UpdateStatusModal.tsx`
5. `AddVehicleModal.tsx`
6. `ViewBranchModal.tsx`

معيار النجاح:

- الملفات الأساسية الجديدة أقل من 30-40 KB قدر الإمكان.
- لا تغيير UX غير مقصود.
- `typecheck` يبقى أخضر.

## المرحلة H - أساس V2 Backend

المدة: ثلاثة إلى خمسة أسابيع.

الهدف: إنشاء الجداول والـ APIs الأساسية للمرحلة التشغيلية.

### H1 - أنواع المستخدمين

أنواع مستخدمين مطلوبة:

- `Admin`
- `Manager`
- `BranchAccount`
- `BranchManager`
- `FieldEmployee`
- `FreeUser`

المهام:

- [ ] توسيع `linkedEntityType` لدعم `branch`.
- [ ] تحديد هل مدير الفرع مستخدم مرتبط بموظف أم دور مستقل.
- [ ] إضافة seed roles إذا كان النموذج سيستخدم roles.
- [ ] تحديث login payload وauth store.

### H2 - Device Binding

جداول:

- `branch_device_bindings`
- `device_access_attempts`

Endpoints:

- `POST /api/device-bindings/request`
- `GET /api/device-bindings/pending`
- `POST /api/device-bindings/:id/approve`
- `POST /api/device-bindings/:id/reject`
- `POST /api/device-bindings/:id/revoke`
- `POST /api/device-bindings/check`

ملاحظات:

- لا يعتمد على `connected_devices` وحده؛ هذا جدول جلسات/أجهزة متصلة، أما binding فهو اعتماد جهاز لفرع.
- أي محاولة غير مصرح بها تسجل وتولد notification للأدمن.

### H3 - الحضور والانصراف

جداول:

- `attendance_records`
- `weekly_schedules`
- `schedule_days`

Endpoints:

- `POST /api/attendance/clock-in`
- `POST /api/attendance/break-start`
- `POST /api/attendance/break-end`
- `POST /api/attendance/clock-out`
- `GET /api/attendance/today`
- `GET /api/attendance/report`
- `POST /api/attendance/:id/correction-request`
- `POST /api/attendance/:id/manual-adjust`

قواعد العمل:

- دعم GPS distance من موقع الفرع.
- دعم صورة حضور وصورة عودة من الاستراحة.
- دعم فترتين عمل عند الحاجة.
- دعم مصدر التسجيل: `mobile`, `fingerprint`, `manual`.
- أي تعديل يدوي يحتاج صلاحية وaudit.

ميزات مقترحة:

- حالة "متأخر بعذر".
- تنبيه عند عدم تسجيل خروج.
- تقرير تأخير/غياب حسب الفرع.
- لاحقاً ربط جهاز بصمة وسحب تلقائي كل فترة.

### H4 - المبيعات اليومية

جداول:

- `daily_sales`
- `sales_line_items`

Endpoints:

- `POST /api/sales/daily`
- `PUT /api/sales/daily/:id`
- `GET /api/sales/daily`
- `GET /api/sales/summary`
- `POST /api/sales/:id/correction-request`

قواعد العمل:

- كل فرع يسجل مبيعات اليوم مرة واحدة مع إمكانية تعديل محمي.
- دعم cash, card, bank transfer, online, other.
- دعم إرفاق صورة Z report أو POS closing.
- فرق بين `submitted`, `approved`, `rejected`, `corrected`.

ميزات مقترحة:

- مقارنة مبيعات الأسبوع الحالي بالسابق.
- كشف فروع لم تسجل مبيعات اليوم.
- تنبيه عند مبيعات صفرية غير مبررة.
- تقرير تحصيل حسب وسيلة الدفع.

### H5 - الطلبات

جداول:

- `requests`
- `request_status_history`

النموذج:

- جدول موحد + JSON payload.
- صلاحيات لكل نوع طلب.
- موافقة واحدة افتراضياً حسب الصلاحية.
- موافقات متعددة اختيارية لاحقاً.

أنواع أولى:

- طلب إجازة.
- طلب سلفة.
- طلب تعديل حضور.
- طلب تعديل مبيعات.
- طلب رفع/تعديل مستند.
- طلب صيانة فرع.
- طلب احتياج فرع.
- طلب نقل موظف أو تغيير فرع.

Endpoints:

- `POST /api/requests`
- `GET /api/requests`
- `GET /api/requests/:id`
- `POST /api/requests/:id/approve`
- `POST /api/requests/:id/reject`
- `POST /api/requests/:id/cancel`
- `POST /api/requests/:id/comment`

ميزات مقترحة:

- SLA لكل نوع طلب.
- تصعيد تلقائي إذا لم يعالج خلال مدة.
- قوالب طلبات قابلة للإعداد.
- ربط الطلب بسجل الموظف أو الفرع أو المبيعات.

### H6 - التنبيهات الإدارية

جداول:

- `admin_notifications`
- `notification_read_status`

Endpoints:

- `GET /api/notifications`
- `POST /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`

القواعد:

- WebSocket للتحديث اللحظي.
- DB هي مصدر الحقيقة عند إغلاق التطبيق.
- Push للموبايل لاحقاً.

## المرحلة I - واجهات Desktop V2

المدة: ثلاثة إلى خمسة أسابيع.

الهدف: توفير واجهات تشغيلية للإدارة والفروع على سطح المكتب.

المهام:

- [ ] شاشة حضور داخل صفحة الفرع.
- [ ] شاشة مبيعات يومية للفرع.
- [ ] لوحة طلبات للإدارة.
- [ ] مركز تنبيهات إداري.
- [ ] Dashboard للأدمن:
  - الحضور اليوم
  - الفروع التي لم ترسل مبيعات
  - الطلبات المتأخرة
  - الوثائق المنتهية
  - أجهزة غير مصرح بها
- [ ] تقارير PDF/Excel للحضور والمبيعات والطلبات.

مبادئ UX:

- الواجهة عملية وكثيفة ومنظمة، لا landing page.
- الجداول قابلة للفلترة والبحث والتصدير.
- كل شاشة حساسة تعرض فقط ما تسمح به الصلاحيات.

## المرحلة J - تطبيق الموبايل Expo

المدة: أربعة إلى ستة أسابيع بعد اكتمال Backend الأساسي.

الهدف: تطبيق موبايل للفرع والموظف، وليس نسخة مصغرة من كل النظام.

الشاشات الأولى:

- Login.
- Device Binding.
- Home حسب نوع المستخدم.
- Attendance.
- Daily Sales.
- Requests.
- Notifications.
- Profile/Documents.

قواعد الموبايل:

- لا يبدأ قبل جاهزية endpoints.
- لا يعتمد على raw SQL.
- يستخدم token auth فقط.
- يدعم حفظ مؤقت محدود عند انقطاع الشبكة للحضور/المبيعات مع sync لاحق.

Push:

- Expo Push كبداية.
- لاحقاً FCM/APNs إذا احتجنا تحكم أعمق.

## المرحلة K - الدردشة الداخلية

المدة: ثلاثة إلى أربعة أسابيع، بعد استقرار الطلبات والتنبيهات.

الهدف: مراسلة داخلية بسيطة ومراقبة، وليست تطبيق دردشة كامل.

جداول:

- `conversations`
- `conversation_members`
- `messages`
- `message_read_status`

القواعد:

- الموظف يتواصل مع مدير فرعه أو الإدارة حسب الصلاحية.
- الإدارة تستطيع بدء محادثة مع فرع أو موظف.
- لا مرفقات في النسخة الأولى إلا إذا كانت حاجة تشغيلية واضحة.
- كل رسالة تحفظ في DB.
- WebSocket للتحديث اللحظي.
- Push عند رسالة جديدة للموبايل.

صلاحيات مقترحة:

- `chat.view`
- `chat.send`
- `chat.dm_any`
- `chat.branch_only`
- `chat.admin_broadcast`
- `chat.moderate`

## المرحلة L - التقارير والذكاء التشغيلي

المدة: مستمرة بعد V2 الأساسي.

تقارير أساسية:

- حضور حسب الفرع/الموظف/الفترة.
- تأخير وغياب.
- مبيعات يومية وشهرية حسب الفرع.
- طلبات حسب الحالة والنوع ووقت المعالجة.
- مستندات منتهية أو ناقصة.
- سكن: ساكنين، كلفة، إشغال.
- مركبات: تأمين/ملكية/مخالفات إن أضيفت لاحقاً.
- هواتف: مسؤولية، شرائح، انتهاء عقود.

ميزات مفيدة لمجال شركة الرداء الموحد:

- قائمة "ناقص اليوم" لكل فرع: مبيعات غير مسجلة، حضور ناقص، طلبات معلقة.
- سجل عهدة الموظف: هاتف، سكن، مركبة، مستندات، فرع.
- تنبيهات عقود الإيجار والرخص والوثائق قبل 90/60/30 يوم.
- QR للفرع يعرض بيانات التواصل والكيان القانوني عند الحاجة.
- مركز صيانة للفروع: بلاغات صيانة، تكلفة، حالة.
- قائمة تجهيز فرع جديد: رخصة، إيجار، موظفون، أجهزة، هواتف، مستندات.
- OCR لاحقاً لاستخراج تواريخ من الوثائق.
- تصنيف المستندات: قانوني، مالي، موظف، مركبة، فرع.

## المرحلة M - الاختبارات والنشر

المدة: أسبوعان كبداية ثم مستمرة.

الاختبارات المطلوبة:

- sqlite-to-mysql translator.
- permissions resolver.
- auth login/change password.
- db/query guard.
- document path security.
- device binding.
- attendance flow.
- daily sales flow.
- request workflow.
- notifications read status.

النشر:

- لا رفع إصدار للمستخدمين قبل:
  - `npm run typecheck`
  - `npm run test:sqlite-mysql`
  - `node --check` لملفات السيرفر
  - smoke test على VPS staging أو نافذة صيانة صغيرة
- كل deploy له rollback.
- كل migration له backup قبله.

## 7. ترتيب التنفيذ المختصر

هذا هو الترتيب الذي يجب السير عليه:

- [x] تحديث المراجع واعتماد هذه الوثيقة.
- [x] إصلاح `npm run typecheck`.
- [ ] تشديد `db/query` (قيد التنفيذ: الحارس والجرد والـ logging أنجزت؛ تم تحويل صلاحيات المستخدمين وأرشفة/استرجاع/حذف الموارد الأساسية؛ باقي المستخدمون/الضرائب).
- [ ] جعل Node هو مسار التطوير الوحيد وترك PHP.
- [ ] إكمال الصلاحيات والأمان.
- [ ] إنشاء migrations مرقمة.
- [ ] تقسيم الملفات الكبيرة.
- [ ] بناء V2 Backend: أجهزة، حضور، جداول، مبيعات، طلبات، تنبيهات.
- [ ] بناء Desktop V2.
- [ ] بناء Mobile Expo.
- [ ] إضافة الدردشة.
- [ ] توسيع التقارير والذكاء التشغيلي.

## 8. تعريف "جاهز للمرحلة 1"

لا تعتبر المرحلة V2 Backend جاهزة للبدء إلا إذا تحقق التالي:

- [x] `npm run typecheck` أخضر.
- [ ] `db/query` لم يعد يستخدم لأي feature جديد.
- [ ] PHP مجمد كـ Legacy.
- [ ] يوجد `database/migrations/` مرقم.
- [ ] يوجد Permission Catalog محدث لمجالات V2.
- [ ] يوجد نمط endpoint واضح: route + validation + permission + service + audit عند الحاجة.
- [ ] يوجد backup حديث قبل أول migration.

## 9. Prompt تشغيل لأي AI أو مبرمج

```text
أنت تعمل على مشروع RMDATA.

اقرأ أولاً:
1. docs/RMDATA_MASTER_PLAN_2026.md
2. AI_MEMORY.md

لا تعتبر أي خطة قديمة مصدر الحالة النهائي إذا تعارضت مع الوثيقة الرئيسية.

قواعد إلزامية:
- لا تعدل dist / dist-electron / release / node_modules.
- لا تضف أي كود جديد إلى PHP Gateway.
- أي ميزة جديدة تكون عبر Node API فقط.
- لا تغيير DB بدون backup وملف migration مرقم.
- كل endpoint جديد يستخدم requireAuth وrequirePermission.
- لا تستخدم db/query في ميزات جديدة.
- لا تبدأ mobile قبل جاهزية Backend V2.

بعد كل جلسة:
- حدث AI_MEMORY.md بسطر مختصر.
- سجل أوامر التحقق ونتائجها.
```

## 10. قرار ختامي

الخطة القديمة التي تقول إن المرحلة 1 هي الخطوة التالية مباشرة غير دقيقة. الخطوة التالية الحقيقية هي إصلاح الأساس: TypeScript، `db/query`, Node-only, migrations, permissions، ثم بناء V2.

عند الانتهاء من هذه القاعدة، ستكون إضافات الحضور والمبيعات والطلبات والدردشة أقل خطراً وأكثر قابلية للصيانة.
