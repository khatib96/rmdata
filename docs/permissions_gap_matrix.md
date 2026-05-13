# مصفوفة فجوة الصلاحيات — الموظفين (Catalog ↔ UI ↔ API)

مصدر الحقيقة للمفاتيح: `server/permissions-catalog.js` + التقييم في `src/services/employeePermissions.ts` و`src/services/permissionsService.ts`.

## نموذج التقييم

1. **تبويب مخفي** (`canEmployeeUiTab` = false): لا يُعرض محتوى التبويب ولا حقوله في الملخص. التبويب يختفي كلياً من خيارات المستخدم.
2. **تبويب ظاهر**: تُقيَّم الحقول بـ `canEmployeeFieldInTab` = تبويب + `canEmployeesFieldView` (مع منطق الراتب الصارم وسلسلة الإسناد الضمني للحقول الجديدة من مفاتيح أقدم).
3. **توافق قديم**: تم إلغاء كافة التبويبات الوهمية والقديمة (`tab.summary.view`, `tab.legal.view`, `tab.financial.view`). الصلاحيات الآن تعتمد حصراً على مفاتيح التبويبات الفعلية (9 تبويبات).

## تبويبات ملف الموظف ↔ `employees.tab.*`

| تبويب | مفاتيح دقيقة (granular) |
|----------|-------------------------|
| basic | `tab.basic.view` |
| passport | `tab.passport.view` |
| contract | `tab.contract.view` |
| residency | `tab.residency.view` |
| insurances | `tab.insurances.view` |
| work-status | `tab.workStatus.view` |
| phones | `tab.phones.view` |
| history | `tab.statusHistory.view` |
| documents | `tab.documents.view` |

## حقول الملخص (`EmployeeSummary`) ↔ `employees.field.*`

| منطقة UI | مفتاح الحقل |
|----------|-------------|
| الجنسية (basic) | `field.nationality.view` |
| البريد (basic) | `field.email.view` |
| الهاتف / أرقام إضافية (basic) | `field.phone.view` |
| رقم الجواز | `field.passportNo.view` |
| إصدار الجواز | `field.passportIssueDate.view` |
| انتهاء الجواز + شارة | `field.passportExpiry.view` |
| الهوية | `field.nationalId.view` |
| إصدار الهوية | `field.emiratesIdIssueDate.view` |
| انتهاء الهوية | `field.emiratesIdExpiry.view` |
| إمارة الإصدار | `field.residencyEmirate.view` |
| اسم صاحب العمل (إقامة) | `field.residencyEmployer.view` |
| رقم منشأة الهجرة | `field.immigrationEstablishment.view` |
| الاسم التجاري للمنشأة (عقد) | `field.contractTradeName.view` |
| رقم المنشأة | `field.contractEstablishmentNumber.view` |
| المهنة حسب العقد | `field.professionContract.view` |
| بداية العقد | `field.contractStartDate.view` |
| انتهاء العقد | `field.contractExpiryField.view` |
| بلوك الراتب | `field.salaryComponents.view` / `field.salaryTotal.view` / `field.contractSalary.view` (كالسابق) |
| التأمين الصحي | `field.healthInsuranceFields.view` |
| التأمين ضد التعطل | `field.unemploymentInsuranceFields.view` |
| نص الحالة الوظيفية | `field.workStatusSummary.view` |
| فرع العمل + الرابط | `field.workBranchLink.view` |
| المهنة في كتلة العمل | `field.professionWork.view` |
| تفاصيل الإعارة الداخلية | `field.secondedLoanDetails.view` |
| الراتب الفعلي | `field.actualSalary.view` |
| صورة البطاقة / القائمة | `field.profilePhoto.view` |
| عرض المهنة في القائمة | `field.professionDisplay.view` |

**إسناد ضمني:** في `permissionsService.ts`، بعض الحقول الدقيقة تُقبل تلقائياً إن وُجد مفتاح أوسع قديم (مثلاً `field.passportNo.view` يغطي تواريخ الجواز؛ `field.contractDetails.view` يغطي حقول العقد غير الراتب؛ `field.nationalId.view` يغطي حقول الإقامة المرتبطة).

## قائمة الموظفين (`Employees.tsx`)

| عنصر | سياسة |
|------|--------|
| صورة | `field.profilePhoto.view` |
| الهاتف | `field.phone.view` |
| المهنة | `field.professionDisplay.view` |
| فرع العمل | `field.workBranchLink.view` |
| تنبيهات الانتهاء | نفس مفاتيح الحقول الزمنية أعلاه (`passportExpiry` → `field.passportExpiry.view`, إلخ) |

## رأس ملف الموظف (`EmployeeHeader.tsx`)

| عنصر | سياسة |
|------|--------|
| صورة كبيرة | `field.profilePhoto.view` (بدونها يُعرض placeholder فقط) |
| سطر المهنة تحت الاسم | `field.professionDisplay.view` |

## مودال إضافة/تعديل (`AddEmployeeModal.tsx`)

| خطوة | تبويب |
|------|--------|
| 1 أساسي | basic |
| 2 جواز | passport |
| 3 عقد | contract |
| 4 إقامة | residency |
| 5 تأمينات | insurances |

الخطوات تُخفى بالكامل إن التبويب غير مرئي. الحقول داخل الخطوة تُقيد بـ`canEmployeeFieldInTab`. عند الحفظ، الأعمدة غير المسموحة لا تُحدَّث من النموذج (في التعديل تُحافظ على القيم السابقة).

## REST (`dev-api-server.js`)

- المسارات `/api/employees/*` تستخدم `requirePermission` كما هي.
- **POST `/api/db/query`**: للعبارات المعدّلة (INSERT/UPDATE/DELETE) يُفرَض على جداول حساسة التحقق من الصلاحية (موظفين: create/edit/delete؛ جداول ربط الصلاحيات: `settings.edit` أو `settings.manage`؛ جدول `permissions`: مسموح لمسؤول الدور فقط).

### جرد مسارات API (ملخص — `requirePermission` حيث يُذكر)

| المسار | ملاحظة |
|--------|--------|
| `GET /api/health` | عام |
| `POST /api/auth/login` | عام |
| `POST /api/auth/change-own-password` | `requireAuth` |
| `POST /api/db/query` | `requireAuth` + فحص طفرات للجداول الحساسة |
| `/api/files/*` | `documents`: view / create / delete |
| `/api/branches` | `branches`: view / create / edit / archive |
| `/api/employees` | `employees`: view / create / edit / archive / delete |
| `/api/employers` | `employers`: … |
| `/api/housing` | `housing`: … |
| `/api/vehicles` | `vehicles`: … |
| `/api/phones` | `phones`: … |
| `/api/settings` | `settings`: view / edit / delete |
| `/api/tax/*` | `settings`: view / edit |
| `GET /api/users` | `users`: view |
| `GET /api/stats/summary` | `logs`: view |

> فلترة حقول JSON لـ GET (مثلاً إخفاء أعمدة الراتب) غير مطبّقة على REST في هذه الدفعة؛ الاعتماد على `employees.field.*` في الواجهة + سياسات الطفرة في `db/query`.

## تدقيق صلاحيات (`permission_audit_logs`)

- جدول اختياري يُنشأ بـ `database/mysql-migrate-permission-audit.sql`.
- عند تغيير `role_permissions` / `user_permissions` / `user_permission_overrides` عبر `db/query` على الخادم التجريبي، تُسجَّل محاولة (أفضل جهد) مع `actorUserId`.

## ثغرات متعمدة / لاحقة

- **SELECT عام عبر `db/query`**: لا يزال يعيد أعمدة كاملة؛ فلترة أعمدة حسب الحقل تتطلب طبقة استعلام أو عرض مخصص.
- **مسارات أخرى**: يتم إدارتها تدريجياً.

---

# مصفوفة فجوة الصلاحيات — الأفرع (Branches)

## نموذج التقييم للأفرع
1. **التبويبات المخفية:** لا تظهر ضمن قائمة التبويبات اطلاقاً عبر الإجبار بـ `canBranchUiTab`.
2. **إخفاء الحقول و التبويبات الفرعية:** عبر دالة `canBranchFieldView`.

## التبويبات الأساسية للفرع ↔ `branches.tab.*`
| تبويب واجهة | مفتاح الصلاحية الدقيق |
|---------------|-------------------------|
| البيانات الأساسية | `tab.basic.view` |
| الرخص والعقود | `tab.licenses.view` |
| المنشأة | `tab.entity.view` |
| موظفو الفرع | `tab.employees.view` |
| أصحاب العمل | `tab.employers.view` |
| سجل الحالة | `tab.history.view` |
| المستندات | `tab.documents.view` |
| الهواتف | `tab.phones.view` |

## الحقول والتفاصيل المخصصة ↔ `branches.field.*`
| الحقل / المنطقة | مفتاح الصلاحية الدقيق |
|------------------|-------------------------|
| مبلغ الإيجار الخاص بالفرع ودفعاته | `field.leaseAmount.view` |
| بيانات المنشأة (الباقات، تواريخ الانتهاء) | `field.entityInfo.view` |
| قائمة موظفي المنشأة (الموجودين على المنشأة أو معارين) | `field.establishmentEmployees.view` |

> **ملاحظة:** عرض رواتب موظفي المنشأة داخل تبويب المنشأة يخضع لنفس شروط قسم الموظفين (`field.actualSalary.view`) لضمان عدم وجود تسريب كلي للبيانات المالية من أي زاوية.
