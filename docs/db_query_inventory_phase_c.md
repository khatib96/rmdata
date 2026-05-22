# db/query Inventory - Phase C

آخر تحديث: 2026-05-22

الغرض من هذا الجرد هو تثبيت نطاق `db/query` قبل بناء V2. هذا المسار Legacy، ولن يستخدم لأي ميزة جديدة.

## 1. نقاط الدخول

| المسار | الحالة بعد المرحلة C |
|---|---|
| `server/dev-api-server.js` - `POST /api/db/query` | محمي بـ allowlist مؤقتة للـ mutations وصلاحيات على السيرفر |
| `electron/ipc/settings-ipc.ts` - `db:query` | يستخدم حارس SQL المحلي قبل التنفيذ أو الإرسال للـ remote |
| `electron/main.ts` - `runDbQueryInternal` | يستخدم نفس حارس SQL المحلي للمسارات الداخلية |
| `electron/remote-api-utils.ts` | يرسل إلى Node `/api/db/query` في remote mode |
| `src/api/browserApiPolyfill.ts` | يستخدم Node `/api/db/query` عند تشغيل الواجهة في المتصفح |
| `api-gateway-php/api/index.php` | Legacy فقط، لا يستخدم لأي V2 جديد |

## 2. استخدامات الواجهة الحالية

الاستخدامات الحالية موزعة على:

- الفروع: `AddBranchModal`, `BranchProfile`, عقود الإيجار والرخص.
- الموظفين: `AddEmployeeModal`, `EmployeeProfile`, `UpdateStatusModal`.
- أصحاب العمل: `AddEmployerModal`, `EmployerProfile`, `LinkBranchModal`.
- الكيانات والضرائب: `AddEntityModal`, `EntityProfile`, `EntityProfileTaxTabs`.
- السكن: `AddHousingModal`, `HousingProfile`, `AssignOccupantModal`.
- المركبات: `AddVehicleModal`, `VehicleProfile`, `AssignResponsibleModal`.
- الهواتف: `AddPhoneModal`, `PhoneProfile`.
- الإعدادات والصلاحيات: `UserPermissionsSettings`, `RolesSettings`, `ConnectedDevicesSettings`.
- خدمات مشتركة: `dbClient`, `settingsService`, `activityLog`, `entityCode`.

## 3. سياسة المرحلة C

### القراءة

- `SELECT` و `WITH` مسموحة مؤقتاً للمستخدم المصادق.
- هذه ليست السياسة النهائية. لاحقاً يجب نقل القراءات الحساسة إلى REST endpoints مع field masking.

### الكتابة

- `INSERT`, `UPDATE`, `DELETE`, `REPLACE` مرفوضة افتراضياً.
- يسمح مؤقتاً فقط للجداول الموجودة في allowlist.
- في Node، كل جدول في allowlist مربوط بصلاحيات تقريبية حسب المجال.
- في Electron local، الحارس يمنع الجداول غير المعروفة، لكن لا يستطيع تطبيق صلاحيات سيرفرية كاملة.

## 4. الجداول المسموح لها مؤقتاً بالكتابة عبر db/query

هذه القائمة مؤقتة حتى يتم تحويل العمليات إلى REST:

- `activity_logs`
- `branch_custom_fields`
- `branch_employers`
- `branch_establishments`
- `branch_leases`
- `branch_licenses`
- `branches`
- `connected_devices`
- `documents`
- `employee_status_history`
- `employees`
- `employers`
- `entities`
- `housing_custom_fields`
- `housing_installments`
- `housing_occupants`
- `housing_units`
- `lease_installments`
- `notifications`
- `permissions`
- `phones`
- `role_permissions`
- `settings`
- `status_history`
- `user_permission_overrides`
- `user_permissions`
- `users`
- `vehicle_custom_fields`
- `vehicles`

## 5. عمليات يجب تحويلها إلى REST أولاً

الأولوية الأعلى:

- صلاحيات المستخدمين: `user_permissions`, `role_permissions`, `permissions`.
- المستخدمون: `users`.
- الأرشفة والحذف: employees, branches, vehicles, phones, housing, entities.
- المستندات: أي حذف أو أرشفة أو تعديل metadata.
- الضرائب والمدفوعات: `tax_payments`, `tax_entity_branches` (تم تحويل مسارات الإضافة/الحذف/استبدال ربط الفروع إلى API/IPC في 2026-05-22).
- إعدادات النظام: `settings`.

الأولوية التالية:

- إنشاء/تعديل الفروع والموظفين والمركبات والسكن والهواتف.
- سجلات الحالة والتاريخ.
- activity logs عبر endpoint داخلي أو service.

## 7. ما تم تحويله إلى API صريح

- حفظ صلاحيات المستخدمين في `UserPermissionsSettings`:
  - Node: `GET /api/users/:id/permissions`
  - Node: `PUT /api/users/:id/permissions`
  - Electron IPC: `permissions:getUserPermissions`
  - Electron IPC: `permissions:setUserPermissions`
  - الواجهة تستخدم `permissionsSetUserPermissions` بدلاً من `DELETE/INSERT user_permissions` المباشر.
- أرشفة واسترجاع السجلات الأساسية:
  - Node: `POST /api/employees/:id/archive`
  - Node: `POST /api/branches/:id/archive`
  - Node: `POST /api/vehicles/:id/archive`
  - Node: `POST /api/housing/:id/archive`
  - Node: `POST /api/phones/:id/archive`
  - Node: `POST /api/entities/:id/archive`
  - Node: `POST /api/employers/:id/archive`
  - Node: `POST /api/employees/:id/restore`
  - Node: `POST /api/branches/:id/restore`
  - Node: `POST /api/vehicles/:id/restore`
  - Node: `POST /api/housing/:id/restore`
  - Node: `POST /api/phones/:id/restore`
  - Node: `POST /api/entities/:id/restore`
  - Node: `POST /api/employers/:id/restore`
  - Electron IPC: `archive:archive`
  - Electron IPC: `archive:restore`
  - الواجهة تستخدم `archiveRecord` و `archiveRestore` بدلاً من `UPDATE ... SET status = ...` المباشر.
- تحديث حالة الموظف وسجل الحالة:
  - Node: `PUT /api/employees/:id/status`
  - Electron IPC: `employee:statusUpdate`
  - الواجهة تستخدم `employeeStatusUpdate` بدلاً من `UPDATE employees` و `INSERT/UPDATE status_history` المباشر في `UpdateStatusModal`.
- الحذف النهائي للموارد الأساسية:
  - Node: `DELETE /api/employees/:id/permanent`
  - Node: `DELETE /api/branches/:id/permanent`
  - Node: `DELETE /api/vehicles/:id/permanent`
  - Node: `DELETE /api/housing/:id/permanent`
  - Node: `DELETE /api/phones/:id/permanent`
  - Node: `DELETE /api/entities/:id/permanent`
  - Node: `DELETE /api/employers/:id/permanent`
  - Electron IPC: `archive:deletePermanent`
  - الواجهة تستخدم `archiveDeletePermanent` بدلاً من سلاسل `DELETE FROM ...` المباشرة في بروفايلات الموارد الأساسية.
- الضرائب والمدفوعات:
  - Node: `POST /api/tax/payments`
  - Node: `DELETE /api/tax/payments/:id`
  - Node: `PUT /api/tax/entity-branches/:entityId`
  - Electron IPC: `tax:paymentCreate`
  - Electron IPC: `tax:paymentDelete`
  - Electron IPC: `tax:entityBranchesReplace`
  - الواجهة تستخدم methods صريحة بدلاً من `INSERT/DELETE tax_payments` و `DELETE/INSERT tax_entity_branches`.
  - تمت إزالة `tax_payments` و `tax_entity_branches` من allowlist المؤقتة للكتابة عبر `dbQuery`.
- تنظيف fallbacks:
  - أزيلت fallbacks القديمة التي كانت تستخدم `dbQuery` للأرشفة والاسترجاع والحذف النهائي عند غياب IPC الجديد.

## 6. قواعد إضافة أي جدول جديد

- لا يضاف جدول جديد إلى allowlist إلا إذا كان جزءاً من Legacy واضح ومؤقت.
- أي جدول V2 جديد ممنوع من `db/query`.
- أي جدول V2 يجب أن يملك REST endpoint مع `requirePermission`.
- عند تحويل عملية إلى REST، تزال من allowlist إن لم تعد مطلوبة.
