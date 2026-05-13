# تقرير مراجعة نظام الصلاحيات الحالي مقابل مقترح إعادة الهيكلة

> [!IMPORTANT]
> **تحديث 12 أبريل 2026**: تم الانتهاء من تنفيذ **المرحلة A (v4 Granular Permissions)** بنجاح.
> الابتكار الرئيسي: حل مشكلة "تضارب المعرفات المحلي/البعيد" عبر استخدام **الاستعلام المبني على اسم المستخدم (Username-based Policy)**.

## 1) ملخص تنفيذي (مُحدّث)

- ✅ **تم التنفيذ**: تم الانتقال من نظام RBAC السطحي إلى نظام Granular v4.
- ✅ **170 صلاحية**: تغطية كاملة لكل الحقول، التبويبات، والإجراءات.
- ✅ **حل مشكلة الهوية**: حل جذري لمشكلة اختلاف الـ ID بين SQLite والسيرفر.
- ✅ **أداء عالٍ**: نظام كاش ذكي مرتبط باليوزرنيم.


---

## 2) ماذا وجدنا في النظام الحالي (من الكود)

## 2.1 بنية الصلاحيات الحالية
- توجد جداول أساسية عبر المايجريشن:
  - `permissions`
  - `role_permissions`
  - `user_permissions`
  - `user_permission_overrides`
  - موجودة في `electron/database/migrations.ts`.
- نمط الصلاحية الحالي: `module + action` (مثل `employees.view`, `vehicles.edit`).
- الأدوار المزروعة حاليا:
  - `Admin`, `Manager`, `Staff`, `Viewer`.

## 2.2 طبقات القرار الحالية
- في `src/services/permissionsService.ts`:
  - صلاحيات الدور + صلاحيات المستخدم الإضافية (`allow`).
  - ثم سحب صلاحيات عبر `user_permission_overrides` (`deny`).
- في `src/hooks/usePermissions.ts`:
  - القرار النهائي غالبا `can(module, action)` للاستخدام في الواجهة.
- في `src/components/Settings/sections/UserPermissionsSettings.tsx`:
  - إدارة صلاحيات المستخدم الإضافية + السحب (deny) موجودة.

## 2.3 الملاحظة المهمة
- التحقق الحالي في الواجهة جيد كبداية، لكن لا يمثل محرك ABAC/Policy متكامل.
- لا توجد حاليا مفاتيح Permission دقيقة جاهزة للتبويبات/الحقول/الإجراءات الدقيقة.
- لا يوجد نموذج جاهز لصلاحيات مرتبطة بسياق الفرع (Branch Context Permissions) بشكل مؤسسي.

---

## 3) مقارنة سريعة مع المقترح الجديد

## 3.1 نقاط متوافقة بالفعل
- لديك بالفعل:
  - Role-based baseline.
  - User-level overrides.
  - Deny precedence على مستوى المستخدم.
- هذا يعني أن الانتقال ليس من الصفر، بل من Base RBAC إلى Engine أدق.

## 3.2 الفجوات التي يغطيها المقترح (ومفقودة الآن)
- Field-level permissions (عرض/تعديل/إخفاء/Masking).
- Tab-level permissions.
- Action-level permissions الحساسة (اعتماد/نشر/تحويل/تسجيل Break لغيره).
- Contextual permissions:
  - بحسب الفرع.
  - بحسب نوع الطلب.
  - بحسب حالة السجل (Pending/Approved/Locked).
- Self permissions workflow (مباشر vs يحتاج موافقة).
- Effective Permissions engine (نتيجة نهائية موحدة قابلة للشرح للمشرف).

---

## 4) تقييم فكرة "إظهار الإجمالي فقط" أو "إخفاء القيم"

فكرتك ممتازة ويجب اعتمادها رسميا ضمن النموذج.

## 4.1 تحديث بشأن الـ Masking (إلغاء بناءً على قرار الإدارة)
- **القرار:** تم إلغاء فكرة الـ Masking واستبعاد حقول مثل `actualSalary.masked` نهائياً من النظام.
- **المنطق المتبع:** تبسيط الخيارات بحيث تكون إما (عرض كامل للبيانات) أو (لا تظهر الخيارات أصلاً ولا يُرى الحقل).

## 4.2 مفاتيح صلاحية مبسطة ومعتمدة
- `employees.field.salaryTotal.view`
- `employees.field.salaryComponents.view`
- `employees.field.salaryComponents.edit`
- `employees.field.actualSalary.view`
- `branches.tabs.lease.view`
- `branches.fields.lease.amount.view`
- `branches.fields.lease.installments.view`

قاعدة القرار:
- إذا لا يملك `actualSalary.view` -> تختفي أعمدة الراتب تماماً من كافة الجداول بما فيها جداول الأفرع.
- إذا لا يملك `components.view` -> تخفى التفاصيل في صفحة الموظف.
- إذا لا يملك `installments.view` -> يخفي جدول الدفعات في الفرع.

---

## 5) المخاطر إن لم ننفذ إعادة الهيكلة

- تضارب صلاحيات مع زيادة المستخدمين/الوحدات.
- تسرب معلومات حساسة (رواتب/عقود/دفعات) عبر صفحات مشتركة.
- تعقيد تشغيلي: نفس الدور لا يكفي لاختلاف صلاحيات المدراء.
- صعوبة التدقيق والمراجعة الأمنية لاحقا.

---

## 6) التوصية: متى ننفذ؟

## القرار الموصى به
- **لا نؤجل التصميم**، ونبدأه من الآن (تصميم مفاتيح الصلاحيات + موديل البيانات).
- **لكن التنفيذ الكامل** يكون بعد استقرار:
  - `0.5` (VPS)
  - `0.6` (Bridge)
  - `0.7` (مطابقة API/Schema)
  - وبداية `0.8` (Node production baseline)

## لماذا؟
- لأن محرك الصلاحيات الجديد يحتاج Backend enforcement قوي.
- لا يصح بناؤه على API غير مستقر أو غير موحد.

---

## 7) دمج المقترح في الخطة الحالية (اقتراح إداري)

إضافة مرحلة جديدة بعد `0.8` مباشرة:

## المرحلة 1.1 — إعادة هيكلة الصلاحيات (Security Core)
- تصميم Permission Catalog v2 (module/tab/field/action/context/self).
- تنفيذ Effective Permissions Resolver.
- إضافة Branch Context Permissions.
- إضافة Field Masking Engine.
- توسيع UI إعداد الصلاحيات إلى:
  - Role baseline
  - User overrides
  - Branch scope
  - Sensitive fields policy
- تطبيق Backend guards بشكل إلزامي.
- إضافة Audit Log لتغييرات الصلاحيات.

---

## 8) شكل التنفيذ المقترح (تقني)

## 8.1 طبقات القرار (Resolution Order)
1. Role baseline
2. User allow/deny
3. Branch context allow/deny
4. Resource-state rules (Pending/Approved/Locked)
5. Sensitive field policy
6. Self permissions policy
7. Final effective decision

## 8.2 Priority Rules
- `deny` أعلى من `allow`.
- القاعدة الافتراضية: `default deny`.
- صلاحيات الحقول الحساسة لا تورث تلقائيا من `module.view`.

## 8.3 واجهة القرار الموحدة
- اقتراح دالة مركزية:
  - `can(user, permissionKey, context?)`
  - `canViewField(user, entity, field, context?)`
  - `getEffectivePermissions(user, context?)`

---

## 9) ملاحظات مهمة قبل التنفيذ

- يجب تثبيت قائمة مفاتيح صلاحيات رسمية (Permission Registry) قبل التطوير.
- منع الصلاحيات النصية العشوائية داخل المكونات.
- أي endpoint حساس (راتب/عقد/دفعات/مستندات) يجب أن يتحقق من الصلاحيات في Backend وليس UI فقط.
- إنشاء شاشة "لماذا المستخدم ممنوع/مسموح" لتقليل اللبس الإداري.

---

## 10) الخلاصة

- تقريرك المقترح قوي وواقعي ومناسب جدا للوضع القادم.
- المشروع الحالي يملك قاعدة جيدة (RBAC + per-user allow/deny) ويمكن البناء عليها.
- الفجوة الأساسية: الدقة والسياق والحساسية (field/tab/context/state/self).
- التوصية العملية:
  - ابدأ الآن في تصميم Permission Model v2.
  - نفذ التطبيق الفعلي بعد تثبيت انتقال VPS وAPI.
  - اعتمد Masking كميزة رسمية (مثل "إجمالي الراتب فقط" و"عرض عقد الإيجار بدون قيمة/دفعات").

---

## 11) إضافات تقنية تفصيلية (اقتراحاتي المباشرة)

## 11.1 تصميم قاعدة بيانات مقترح (v2 Permissions)

> الفكرة: نبقي الجداول الحالية (`permissions`, `role_permissions`, `user_permissions`, `user_permission_overrides`) ونعززها بجداول سياق + سياسة حقول + تدقيق.

### جداول جديدة مقترحة

```sql
-- 1) صلاحيات مرتبطة بالفرع والسياق
CREATE TABLE IF NOT EXISTS branch_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(64) NOT NULL UNIQUE,             -- branch_manager, branch_supervisor_1...
  nameAr VARCHAR(150) NOT NULL,
  nameEn VARCHAR(150),
  isSystem INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_branch_roles (
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branchId INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  branchRoleId INTEGER NOT NULL REFERENCES branch_roles(id) ON DELETE CASCADE,
  startsAt DATETIME NULL,
  endsAt DATETIME NULL,
  isActive INTEGER DEFAULT 1,
  assignedByUserId INTEGER NULL REFERENCES users(id),
  assignedAt DATETIME DEFAULT (datetime('now')),
  PRIMARY KEY (userId, branchId, branchRoleId)
);

-- 2) ربط صلاحيات بالدور الفرعي
CREATE TABLE IF NOT EXISTS branch_role_permissions (
  branchRoleId INTEGER NOT NULL REFERENCES branch_roles(id) ON DELETE CASCADE,
  permissionId INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (branchRoleId, permissionId)
);

-- 3) سياسة حساسية الحقول (تعريف)
CREATE TABLE IF NOT EXISTS permission_sensitive_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity VARCHAR(80) NOT NULL,                  -- employees, branches, leases...
  field VARCHAR(120) NOT NULL,                  -- salaryActual, leaseAmount...
  sensitivityLevel VARCHAR(30) NOT NULL,        -- low, medium, high, critical
  UNIQUE(entity, field)
);

-- 4) سياسة العرض/الإخفاء/الماسكينغ على مستوى المستخدم
CREATE TABLE IF NOT EXISTS user_field_policies (
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity VARCHAR(80) NOT NULL,
  field VARCHAR(120) NOT NULL,
  accessMode VARCHAR(30) NOT NULL,              -- hidden, read_only, editable, masked
  maskPattern VARCHAR(100) NULL,                -- last3, amount_band, custom
  PRIMARY KEY (userId, entity, field)
);

-- 5) سياسة العرض/الإخفاء/الماسكينغ على مستوى الدور
CREATE TABLE IF NOT EXISTS role_field_policies (
  roleId INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  entity VARCHAR(80) NOT NULL,
  field VARCHAR(120) NOT NULL,
  accessMode VARCHAR(30) NOT NULL,              -- hidden, read_only, editable, masked
  maskPattern VARCHAR(100) NULL,
  PRIMARY KEY (roleId, entity, field)
);

-- 6) صلاحيات مؤقتة
CREATE TABLE IF NOT EXISTS temporary_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permissionId INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scopeType VARCHAR(30) NULL,                   -- global, branch, entity
  scopeId INTEGER NULL,
  startsAt DATETIME NOT NULL,
  endsAt DATETIME NOT NULL,
  grantedByUserId INTEGER NULL REFERENCES users(id),
  createdAt DATETIME DEFAULT (datetime('now'))
);

-- 7) سجل تدقيق تغييرات الصلاحيات
CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actorUserId INTEGER NOT NULL REFERENCES users(id),
  targetUserId INTEGER NULL REFERENCES users(id),
  actionType VARCHAR(60) NOT NULL,              -- grant, deny, revoke, assign_branch_role...
  payloadJson TEXT NOT NULL,
  createdAt DATETIME DEFAULT (datetime('now'))
);
```

### لماذا هذا التصميم؟
- يحافظ على توافق مع النظام الحالي.
- يضيف سياق الفرع دون كسر الصلاحيات الحالية.
- يسمح بتوسيع تدريجي (Feature flag) وليس Big Bang.

---

## 11.2 كتالوج مفاتيح الصلاحيات (Permission Catalog v2)

### نمط موحد مقترح
- `module.<name>.view`
- `module.<name>.create`
- `module.<name>.edit`
- `module.<name>.delete`
- `tab.<module>.<tab>.view`
- `field.<entity>.<field>.view`
- `field.<entity>.<field>.edit`
- `action.<module>.<action>`
- `request.<type>.view`
- `request.<type>.approve`
- `request.<type>.reject`
- `self.<action>`

### أمثلة جاهزة من واقع احتياجك
- `field.employees.salaryTotal.view`
- `field.employees.salaryComponents.view`
- `field.employees.salaryComponents.masked`
- `field.branches.leaseAmount.view`
- `field.branches.leaseInstallments.view`
- `tab.employees.contract.view`
- `tab.employees.salary.view`
- `action.attendance.breakForOthers`
- `request.salary_advance.approve`
- `request.leave.approve`
- `self.profile.edit.basic`
- `self.phone.change.request`

---

## 11.3 محرك القرار النهائي (Effective Permissions Resolver)

## ترتيب القرار المقترح (نهائي)
1. Base Role permissions
2. User allow
3. User deny (يسقط أي سماح)
4. Branch-role permissions (عند وجود branch context)
5. Temporary permissions (valid by date)
6. Field policy (hidden/masked/read_only/editable)
7. Resource-state rules (Pending/Approved/Locked)

### قاعدة حسم التعارض
- `deny` يتغلب دائما.
- `hidden` يتغلب على `masked/read_only/editable`.
- إذا لا يوجد تصريح صريح: `default deny`.

---

## 12) اقتراح معماري للتنفيذ داخل المشروع الحالي

## 12.1 طبقة Backend
- إضافة Service موحد:
  - `PermissionResolverService`
  - مدخلات: `userId`, `permissionKey`, `context`
  - مخرجات: `allowed`, `reason`, `mode` (`hidden/masked/read_only/editable`)
- منع استعلامات raw حساسة بدون resolver check.
- تطبيق check إلزامي قبل أي endpoint حساس (salary, lease, bank, documents).

## 12.2 طبقة Frontend
- تطوير hook جديد:
  - `useEffectivePermissions(context)`
  - بدل الاعتماد فقط على `can(module, action)`.
- UI controls:
  - `Can` component
  - `FieldGuard` component
  - `MaskValue` helper

## 12.3 طبقة Shared Contracts
- تعريف type موحد:
  - `PermissionKey`
  - `PermissionContext`
  - `FieldAccessMode`
- منع المفاتيح النصية الحرة عبر union types/codegen.

---

## 13) نموذج Masking عملي (كما طلبت)

## سيناريو 1: راتب العقد
- يملك المستخدم: `field.employees.salaryTotal.view`
- لا يملك: `field.employees.salaryComponents.view`
- النتيجة:
  - يظهر: إجمالي الراتب
  - لا يظهر: basic/housing/transport/allowances breakdown

## سيناريو 2: عقد الإيجار
- يملك المستخدم: `tab.branches.lease.view`
- لا يملك: `field.branches.leaseAmount.view`
- لا يملك: `field.branches.leaseInstallments.view`
- النتيجة:
  - يرى بيانات العقد العامة (رقم العقد، المالك، التواريخ)
  - لا يرى قيمة الإيجار
  - لا يرى جدول الدفعات

## سيناريو 3: عرض مقنع (Masked)
- يملك: `field.branches.leaseAmount.masked`
- النتيجة:
  - يظهر نطاق تقريبي فقط (مثال: `>= 10,000` أو `***500`)

---

## 14) خطة تنفيذ مرحلية بدون مخاطرة (MVP -> Full)

## المرحلة A (سريعة 1-2 أسبوع) - MVP أمني
- إدخال Permission Catalog v2 في DB.
- تطبيق Tab-level وAction-level على أهم الشاشات.
- تفعيل resolver backend للرواتب والعقود فقط.
- إضافة audit log لأي تغيير صلاحيات.

## المرحلة B (2-3 أسابيع) - Field-level + Masking
- تفعيل field policies على:
  - الرواتب
  - عقود الإيجار
  - البيانات البنكية
- إضافة UI للـ Masking modes.

## المرحلة C (2 أسبوع) - Branch context
- branch roles + branch role permissions.
- تفعيل سياق الفرع في الحضور/الجداول/الطلبات.

## المرحلة D (1-2 أسبوع) - Self-service + approvals
- طلبات تعديل البيانات الذاتية (Pending/Approve/Reject).
- إشعارات عند منح/سحب الصلاحيات.

---

## 15) قرارات يجب حسمها قبل البدء

- هل سيتم إيقاف `viewer` فعلا أم إبقاؤه كدور مقيد؟
- ما هي أول 10 حقول "Critical" تبدأ بها سياسة الحماية؟
- ما هو تعريف branch manager الرسمي (صلاحيات إلزامية دنيا)؟
- هل الـ masking سيكون static patterns أم custom expression؟
- من يملك صلاحية تعديل صلاحيات المستخدمين (admin فقط أم admin+security manager)؟

---

## 16) مؤشرات نجاح (Acceptance Criteria)

- لا يمكن لأي مستخدم الوصول لبيانات salary/lease الحساسة بدون تصريح backend.
- نتيجة `effective permissions` قابلة للعرض في شاشة توضيحية للمشرف.
- أي تغيير صلاحية يظهر في `permission_audit_logs`.
- دعم deny override فعلي مع تغليب المنع.
- نجاح 20 سيناريو UAT على الأقل (role/user/branch/state/masking).

---

## 17) موقفي النهائي (بعد قراءة تقريرك بالكامل)

- نعم، قرأت تقريرك بشكل كامل وهو ممتاز فكريا.
- وأوافق على اتجاه "إعادة بناء مفهوم الصلاحيات" وليس مجرد ترقيع.
- ملاحظتك بخصوص "عرض الإجمالي دون التفاصيل" و"رؤية العقد دون القيمة/الدفعات" هي نقطة محورية، ويجب اعتمادها كمتطلب رسمي في MVP وليس لاحقا.
- اقتراحي التنفيذي: نبدأ تصميمه من الآن (Schema + Catalog + Resolver design) وننفذ على مراحل مدروسة بعد استقرار مسار VPS/Bridge كما هو مخطط.

---

## 18) Performance — الأداء (إلزامي مع محرك الصلاحيات)

> محرك صلاحيات متعدد الطبقات **ثقيل** إذا حُسبت النتيجة من الصفر على كل طلب HTTP أو كل نقرة في الواجهة. يجب تصميم الأداء من اليوم الأول.

### 18.1 المبدأ
- **لا** إعادة حساب Effective Permissions كاملة على كل `request` إلا عند الضرورة.
- **نعم** تخزين مؤقت (caching) للنتيجة أو لطبقاتها، مع إبطال صحيح عند التغيير.

### 18.2 طبقات الكاش المقترحة

| الطبقة | ماذا تُخزّن | أين |
|--------|-------------|-----|
| **Session bootstrap** | قائمة مفاتيح الصلاحيات الفعّالة للمستخدم (أو hash مختصر) بعد تسجيل الدخول | استجابة login + تخزين في الذاكرة (renderer) / جلسة الخادم |
| **Server-side cache** | نتيجة `resolve(userId, context)` لمدة قصيرة أو حتى `permissionVersion` يتغير | Redis أو in-memory LRU داخل عملية Node (حسب البيئة) |
| **Client cache** | نفس القائمة في `zustand`/memory مع `clearPermissionsCache` عند الحدث `permissions-changed` | موجود فعليًا كنمط؛ يُوسَّع ليشمل v2 keys |

### 18.3 مفتاح الكاش (Cache key)
- مقترح: `perm:{userId}:{permissionVersion}:{branchId?}:{contextHash?}`
- **`permissionVersion`**: رقم صحيح يزيد عند أي تغيير يؤثر على صلاحيات المستخدم (منح/منع/دور/فرع/صلاحية مؤقتة).
  - يمكن تخزينه في عمود `users.permissionVersion` أو جدول `user_permission_cache_meta`.

### 18.4 إبطال الكاش (Invalidation) — لا تُنسى
- عند: تعديل `role_permissions`، `user_permissions`، `user_permission_overrides`، أدوار الفرع، صلاحيات مؤقتة، سياسات الحقول.
- زيادة `permissionVersion` للمستخدم المتأثر (وللمجموعات إن لزم: كل من له نفس الدور — أو تبسيط: invalidate واسع نادرًا).
- بث حدث للعميل: مثل `permissions-changed` الموجود حاليًا.

### 18.5 ماذا لا نفعل
- لا تشغيل 10 استعلامات JOIN لكل API call لحساب صلاحية حقل واحد.
- لا جلب «كل الصلاحيات الممكنة في النظام» في كل طلب؛ جلب **المُفعّلة فقط** أو **مسبقة التجميع** عند الدخول.

### 18.6 قياس الأداء
- تسجيل زمن `resolvePermission` في التطوير (p95).
- هدف تقريبي: &lt; 5ms من الكاش الساخن؛ &lt; 50ms من قاعدة البيانات عند فقدان الكاش.

---

## 19) ربط هذا التقرير بالخطة الرئيسية

- مدمج في **`docs/v2_review_report1.md`** كـ **المرحلة 0.8** (إعادة هيكلة الصلاحيات + Performance).
- تفاصيل التصميم الكاملة تبقى في هذا الملف؛ الخطة تحتوي checklist تنفيذ عالي المستوى.
- **Checklist التنفيذ العملي للمرحلة A:** [`docs/permissions_phaseA_checklist.md`](permissions_phaseA_checklist.md).

### 19.1 تشديد `POST /api/db/query` — المرحلة 0.85 (قرار توثيقي)

- **ليس** جزءاً أساسياً من تعريف **0.8** في الخطة الحالية (0.8 = Catalog + Resolver + كاش + guards على الموارد + §18 أداء).
- **مجدول لـ 0.85** مع تثبيت الإنتاج على Node: سياسة **SELECT-only** و/أو **رفض الكتابة عبر SQL الخام** إلا بصلاحية صريحة، و**تقليل SQL الخام** تدريجياً؛ راجع الفقرة التعريفية وقائمة المهام تحت **«المرحلة 0.85»** في [`v2_review_report1.md`](v2_review_report1.md).
- **اختياري بعد Resolver:** ربط السماح بالكتابة عبر `db/query` بمفتاح صلاحية (مثال مقترح: `api.db.query.mutate`) حتى لا يعتمد الأمن على «أي مستخدم موثّق» فقط.

