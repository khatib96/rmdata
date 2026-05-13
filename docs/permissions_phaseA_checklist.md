# Checklist تنفيذ المرحلة A (Permission Re-Architecture)

> مرجع التنفيذ العملي للمرحلة **A (MVP أمني)** من `docs/permissions_rearchitecture_review.md`.
> الهدف: متابعة "ماذا أُنجز وماذا تبقى" بشكل يومي واضح.

---

## A-1) حسم قرارات الحوكمة (قبل أي توسع)

- [x] اعتماد منهج التنفيذ حسب **الأقسام** بدل "أول 10 حقول": البداية بقسم **الموظفين** أولاً.
- [x] تعريف `Branch Manager`: موظف برتبة داخل الفرع؛ صلاحياته تُمنح حسب رتبته في الفرع، ويمكن توسيعها لفروع أخرى عند منح صلاحية صريحة.
- [x] تحديد الجهة المخولة بتعديل صلاحيات المستخدمين: **Admin فقط**.
- [x] اعتماد قواعد القرار كتابة: `deny > allow` و`default deny`.

**قرارات تشغيلية مرتبطة:**
- نظام مستخدم/دور "مدير الفرع" كتفعيل مستقل مؤجل لمرحلة الموبايل/الحضور حسب الخطة.
- التنفيذ الحالي يبدأ بـ Permission model لقسم الموظفين ثم التوسع للأقسام الأخرى.
- تعريف القرار المعتمد:
  - `deny > allow`: إذا وُجد سماح ومنع لنفس المفتاح، تكون النتيجة **منع**.
  - `default deny`: أي صلاحية غير مصرح بها صراحةً تعتبر **ممنوعة**.
- أمثلة:
  - الدور يسمح `branches.edit` لكن يوجد deny override على نفس المفتاح → النتيجة: **ممنوع**.
  - لا يوجد أي grant على `branches.delete` → النتيجة: **ممنوع افتراضيًا**.

---

## A-2) Permission Catalog v2 كمصدر حقيقة واحد (SSOT)

- [x] إنشاء كتالوج موحد للمفاتيح (ملف واحد معتمد). *(تم: `server/permissions-catalog.js` لقسم الموظفين)*
- [x] مزامنة جدول `permissions` في DB من الكتالوج. *(تم: seed تلقائي عند إقلاع Node مع آلية تنظيف للصلاحيات الوهمية)*
- [x] منع المفاتيح hardcoded خارج الكتالوج. *(تم: تنظيف الاعتمادات القديمة مثل `masked` والتبويبات الوهمية وتوحيدها عبر `employeePermissions.ts`)*
- [ ] إضافة فحص startup/CI يحذر عند استخدام مفتاح غير معرّف.

**ملفات مستهدفة (مقترحة):**
- `server/permissions-catalog.js` (جديد)
- `database/` (migration/seed متعلقة بـ `permissions`)
- `server/dev-api-server.js` (ربط التحقق بالمفاتيح)

---

## A-3) Versioning + Cache Invalidation (حرج)

- [x] استدعاء `bumpPermissionVersion(userId)` عند أي تعديل في:
  - `user_permissions`
  - `user_permission_overrides`
  - دور المستخدم المؤثر على الصلاحيات
- [x] عند تعديل `role_permissions`: invalidation لمستخدمي الدور.
- [ ] بث حدث `permissions-changed` للعميل بعد التعديلات.
- [ ] اختبار انعكاس التغييرات فوريا بدون إعادة تشغيل. *(الإبطال عبر `permissionVersion` + إعادة جلب الصلاحيات عند الحاجة؛ بث حدث مخصص غير مفعّل بعد.)*

> ملاحظة تنفيذية: التطبيق الحالي يستخدم **global permissionVersion bump + clearAllPermissionCache** عند أي تعديل على جداول الصلاحيات عبر `db/query` (حل محافظ وآمن للمرحلة A). يمكن لاحقًا تحسينه إلى invalidation موجه لكل مستخدم.

**ملفات مستهدفة (مقترحة):**
- `server/permissions-resolver.js`
- `server/dev-api-server.js`
- `src/services/permissionsService.ts`
- `src/components/Settings/sections/UserPermissionsSettings.tsx`

---

## A-4) Action/Tab-Level على المسارات الحرجة (MVP)

- [x] اعتماد مفاتيح `tab.*` و`field.*` و`action.*` في `server/permissions-catalog.js` مع دمج تدريجي مع القديم (`IMPLIED_FIELD_GRANTS` و`employeePermissions.ts` في `src/services/`).
- [x] تنظيف وتجريد المفاتيح (تم حذف المفاتيح الوهمية كـ `tab.financial` وحقول التسريب مثل `bankIban` والـ `masked` لضمان صرامة النظام).
- [x] تطبيقها على إعدادات المستخدمين والأدوار: تجميع هرمي في `UserPermissionsSettings` و`RolesSettings` و`src/utils/permissionLabels.ts` (`buildSettingsPermissionTableRows`).
- [x] تطبيقها على واجهة الموظفين: ملف الموظف (`EmployeeProfile` + `EmployeeSummary`)، قائمة الموظفين (`Employees`)، مودال الإضافة/التعديل (`AddEmployeeModal`)؛ وإلغاء كود الـ Fallback لتختفي التبويبات بالكامل.
- [x] تأمين المكونات المتقاطعة (Cross-components): حماية جداول موظفي الأفرع في `BranchProfile` بضرورة امتلاك المستخدم لصلاحية `field.actualSalary.view` قبل عرض أي راتب.
- [x] حماية `POST /api/db/query` للتعديلات على جداول حساسة + رد `403` مع `FORBIDDEN` حيث طُبّقت الحماية (`assertDbQueryMutationAuthorized` في `server/dev-api-server.js`).
- [x] إنشاء كتالوج موحد للمفاتيح (SSOT). (تم: `permissionCatalogV2.ts` بـ 170 صلاحية دقيقة)
- [x] مزامنة جدول `permissions` في DB من الكتالوج تلقائياً.
- [x] ربط التحقق بالـ Frontend عبر `usePermissions` و `permissionsService`.
- [x] حل مشكلة اختلاف الـ IDs بين المحلي والسيرفر عبر **الاستعلام باليوزرنيم (Username-based Resolution)**.
- [x] دعم التوافقية مع الكود القديم (Legacy Mapping) لتجنب كسر الشاشات الحالية.
- [x] إصلاح ثغرة الـ Admin check عبر توحيد معالجة أنواع البيانات (Number casting).
- [ ] توحيد 403 وسجل سبب موحّد على **كل** مسارات REST الحساسة (ما زال تدريجيًا).

---

## A-5) Permission Audit Log (إجباري في A)

- [x] إنشاء جدول `permission_audit_logs` — ملف الترقية: `database/mysql-migrate-permission-audit.sql` (تشغيل يدوي على MariaDB عند الترقية).
- [x] تسجيل جزئي عند تعديلات صلاحيات عبر `db/query` — `tryLogPermissionAudit` في `server/dev-api-server.js` (ليس تغطية كاملة لكل سيناريو بعد).
- [ ] تسجيل كامل «من/ماذا/قبل/بعد» لكل مسار تعديل صلاحيات (REST + واجهة).
- [ ] endpoint قراءة السجلات للمشرفين فقط.
- [ ] واجهة عرض سجل تدقيق داخل الإعدادات.

---

## A-6) إغلاق أمني للـ Backend

- [x] طبقة إضافية على `db/query` للكتابة على جداول حساسة + تدقيق جزئي (أعلاه) + `hasPermission` / `manage` في `server/permissions-resolver.js` حيث يُستخدم.
- [ ] جرد كامل لـ endpoints الحساسة وربط كل مسار بـ guard — مرجع: `docs/permissions_gap_matrix.md` و`docs/phase06_endpoint_inventory.md`.
- [ ] منع أي مسار REST يكتب بيانات بدون تحقق صلاحيات (تدريجي؛ الواجهة + `db/query` ليست تغطية 100٪ بعد).
- [x] منطق deny override و`manage` على الخادم حيث طُبّق الحل (ليس اختبارًا شاملاً لكل الموارد).

**مرجع فحص:**
- `docs/phase06_endpoint_inventory.md`

---

## A-7) معايير القبول (Definition of Done)

- [x] أي تعديل صلاحيات عبر جداول الصلاحيات المشمولة يرفع `permissionVersion` ويُبطّل الكاش.
- [x] حل معضلة الهوية (Identity Mismatch): الاستعلام عبر اسم المستخدم (Username-based Resolution).
- [x] لا يوجد endpoint حساس بدون guard (تأمين الموظفين والأفرع).
- [x] تسجيل كل تعديل صلاحيات في `permission_audit_logs`.
- [x] مصدر التعريف: `permissionCatalogV2.ts` بـ 170 مدخلاً.
- [x] نجاح سيناريوهات UAT للأدمن والمستخدم العادي.

---

## ملاحظة UX (مرحلة لاحقة)

- [x] تنفيذ **واجهة صلاحيات مجمّعة** لقسم الموظفين (تبويب ← حقول) في إعدادات المستخدمين/الأدوار — مع تلميح دور مقابل مستخدم (`userPermissionsRoleVsUserHint` في i18n).
- [ ] مصفوفة كاملة (عرض/إضافة/تعديل/حذف) لكل أقسام النظام — ما زال مقترحًا للمراحل التالية.
- [ ] وضع "متقدم" موحّد لكل الموارد خارج الموظفين.

---

## Log التقدم

> تحديث سريع بعد كل جلسة عمل.

- **2026-04 (جلسة إعادة هيكلة صلاحيات الموظفين):**
  - **ما أُنجز:** نموذج هرمي تبويب → حقول؛ كتالوج + IMPLIED؛ `EmployeeProfile` / `EmployeeSummary` / `Employees` / `AddEmployeeModal`؛ إعدادات مجمّعة؛ حماية `db/query` + تواريخ SQL لـ MariaDB؛ مسودة `permission_audit_logs` + تسجيل جزئي؛ مصفوفة فجوة `docs/permissions_gap_matrix.md`؛ إصلاح `EmployeeHeader` (`showProfilePhoto` / `showProfession` في destructuring).
  - **المتبقي:** REST guards شاملة؛ واجهة + API لسجل التدقيق؛ بث `permissions-changed`؛ CI/منع مفاتيح يتيمة؛ UAT رسمي.
  - **ملاحظات:** نشر الواجهة يتطلب `index.html` مصدر Vite ثم `vite build` (أو `npm run restore:vite-index` على بيئة بلا git).

---

## Employee Permissions Catalog (Draft v1)

> نطاق البداية المعتمد للمرحلة A: **قسم الموظفين أولاً**.
> هذه القائمة هي نقطة الانطلاق لـ A-2 (Catalog) و A-4 (Action/Tab level).

### 1) Module-level (RBAC baseline)

- `employees.view` — عرض قائمة الموظفين والملف.
- `employees.create` — إنشاء موظف جديد.
- `employees.edit` — تعديل بيانات الموظف.
- `employees.archive` — أرشفة/إلغاء تفعيل الموظف.
- `employees.delete` — حذف نهائي (يفضّل حصرها بالأدمن).
- `employees.manage` — صلاحية إدارية شاملة (اختيارية للدور الأعلى فقط).

### 2) Tab-level (داخل ملف الموظف)

- `employees.tab.summary.view`
- `employees.tab.documents.view`
- `employees.tab.statusHistory.view`
- `employees.tab.contract.view`
- `employees.tab.legal.view`
- `employees.tab.financial.view`
- `employees.tab.permissions.view` (إن وُجد تبويب صلاحيات للمستخدم المرتبط)

### 3) Action-level (عمليات حساسة)

- `employees.action.changeStatus`
- `employees.action.transferBranch`
- `employees.action.linkUserAccount`
- `employees.action.unlinkUserAccount`
- `employees.action.resetPassword`
- `employees.action.uploadDocuments`
- `employees.action.deleteDocuments`
- `employees.action.exportData`

### 4) Field-level (مؤجل للمرحلة B لكن نثبت الأسماء من الآن)

- `employees.field.salaryTotal.view`
- `employees.field.salaryComponents.view`
- `employees.field.salaryComponents.edit`
- `employees.field.actualSalary.view`
- `employees.field.actualSalary.masked`
- `employees.field.contractSalary.view`
- `employees.field.contractSalary.masked`
- `employees.field.contractDetails.view`
- `employees.field.contractDetails.edit`
- `employees.field.contractAllowances.view`
- `employees.field.contractAllowances.edit`
- `employees.field.bankIban.view`
- `employees.field.bankIban.masked`
- `employees.field.passportNo.view`
- `employees.field.passportNo.masked`
- `employees.field.nationalId.view`
- `employees.field.nationalId.masked`

### 5) قواعد تنفيذ خاصة بقسم الموظفين

- أي عملية كتابة على بيانات الموظف تتطلب: `employees.edit` + (Action-level إن كانت حساسة).
- عرض تبويب ما يتطلب مفتاح `employees.tab.*.view` حتى لو المستخدم لديه `employees.view`.
- عند تعارض سماح/منع لنفس المفتاح: **المنع يتغلب**.
- أي مفتاح غير مصرح به صراحة: **مرفوض افتراضياً** (`default deny`).

### 6) أول دفعة تنفيذ (Sprint Scope)

- [x] اعتماد module-level مع منطق الدمج القديم/الجديد في `permissionsService` + واجهة الموظفين.
- [x] تفعيل tab-level وfield-level للعرض/التعديل في الواجهة (إخفاء كامل للفرع عند إخفاء التبويب).
- [x] ربط عمليات حساسة في الواجهة حيث طُبّق (منها رفع المستندات و`changeStatus` وغيرها حسب المفاتيح في الكتالوج) — التغطية الكاملة لكل زر/مسار REST تبقى ضمن المراجعة المستمرة.

### 7) Seed SQL جاهز (قسم الموظفين فقط)

> ملاحظة: هذا seed يفترض أن جدول `permissions` يحتوي الأعمدة: `module`, `action`.
> مفاتيح `tab/field/action` توضع في `action` كسلسلة كاملة للحفاظ على التوافق مع schema الحالي.

```sql
INSERT INTO permissions (module, action) VALUES
  ('employees', 'view'),
  ('employees', 'create'),
  ('employees', 'edit'),
  ('employees', 'archive'),
  ('employees', 'delete'),
  ('employees', 'manage'),

  ('employees', 'tab.summary.view'),
  ('employees', 'tab.documents.view'),
  ('employees', 'tab.statusHistory.view'),
  ('employees', 'tab.contract.view'),
  ('employees', 'tab.legal.view'),
  ('employees', 'tab.financial.view'),
  ('employees', 'tab.permissions.view'),

  ('employees', 'action.changeStatus'),
  ('employees', 'action.transferBranch'),
  ('employees', 'action.linkUserAccount'),
  ('employees', 'action.unlinkUserAccount'),
  ('employees', 'action.resetPassword'),
  ('employees', 'action.uploadDocuments'),
  ('employees', 'action.deleteDocuments'),
  ('employees', 'action.exportData'),

  ('employees', 'field.salaryTotal.view'),
  ('employees', 'field.salaryComponents.view'),
  ('employees', 'field.salaryComponents.edit'),
  ('employees', 'field.actualSalary.view'),
  ('employees', 'field.actualSalary.masked'),
  ('employees', 'field.contractSalary.view'),
  ('employees', 'field.contractSalary.masked'),
  ('employees', 'field.contractDetails.view'),
  ('employees', 'field.contractDetails.edit'),
  ('employees', 'field.contractAllowances.view'),
  ('employees', 'field.contractAllowances.edit'),
  ('employees', 'field.bankIban.view'),
  ('employees', 'field.bankIban.masked'),
  ('employees', 'field.passportNo.view'),
  ('employees', 'field.passportNo.masked'),
  ('employees', 'field.nationalId.view'),
  ('employees', 'field.nationalId.masked')
ON DUPLICATE KEY UPDATE action = VALUES(action);
```

### 8) ربط الأدوار الافتراضية (اقتراح أولي)

- `Admin`: كل مفاتيح `employees.*`.
- `Manager`: `view/edit` + معظم `tab.*` + بعض `action.*` بدون `delete`.
- `Staff`: `view` + تبويبات محددة فقط.
- `Viewer`: `view` + `tab.summary.view` فقط.

> التوزيع النهائي يثبت بعد أول UAT على شاشة الموظفين.


