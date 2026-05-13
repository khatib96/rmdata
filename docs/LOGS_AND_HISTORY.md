# السجل وآلية عمله — شرح تفصيلي

هذا المستند يشرح للمبرمج أو أداة الذكاء الاصطناعي كيف يعمل **نظام السجل** في التطبيق: جدولا `activity_logs` و`status_history`، آلية التسجيل، مكوّن تبويب السجل داخل البروفايل، وصفحة سجل النظام العامة.

---

## 1. نظرة عامة

النظام يعتمد على مصدرين رئيسيين للسجل:

| المصدر | الجدول | الغرض |
|--------|--------|--------|
| **سجل النشاط** | `activity_logs` | تسجيل كل الإجراءات (أرشفة، استعادة، تحديث انتهاء، تعيين مسؤول، إلخ) مع المستخدم المسؤول |
| **سجل الحالات** | `status_history` | تسجيل تغييرات **حالة الموظف** فقط (يعمل، إجازة، معار، إنهاء، إلخ) مع التواريخ والمدة |

- **سجل النظام** (صفحة `/dashboard/logs`): عرض موحّد لآخر 1000 سجل من `activity_logs` مع بحث واسم العنصر.
- **تبويب السجل** (داخل البروفايل): دمج `status_history` (للموظفين فقط) و`activity_logs` لعرض سجل مرتبط بعنصر واحد (فرع، موظف، مركبة، سكن).

---

## 2. جدول سجل النشاط: `activity_logs`

### بنية الجدول

| العمود | النوع | الوصف |
|--------|--------|--------|
| `id` | INTEGER PK | المعرف |
| `createdAt` | TEXT | وقت الحدث (افتراضي: datetime('now')) |
| `module` | TEXT | القسم/الموديول: employee, branch, vehicle, housing, entity, archive, tax, ... |
| `action` | TEXT | نوع الإجراء: status_change, expiry_update, create, edit, archive, restore, assign_responsible, assign_occupant, date_correction |
| `entityType` | TEXT | نوع الكيان: employee, branch, vehicle, housing, entity, license, lease, ... |
| `entityId` | INTEGER | معرف السجل المرتبط (موظف، فرع، مركبة، سكن، كيان) |
| `details` | TEXT | نص وصفي للإجراء (يُعرض في الواجهة) |
| `performedByUserId` | INTEGER | معرف المستخدم المنفّذ (إن وُجد) |
| `performedByUsername` | TEXT | اسم المستخدم أو "النظام" عند الأرشفة التلقائية |
| `performedByUserCode` | TEXT | كود المستخدم (مثل RME0001) للعرض مع الاسم |

**الإنشاء:** يتم في Electron عند تهيئة قاعدة البيانات؛ تُضاف عمود `performedByUserCode` عبر migration إن لم يكن موجوداً.

### دوال التسجيل

**المصدر:** `src/utils/activityLog.ts`

```typescript
logActivity(params: ActivityLogParams): Promise<boolean>
```

- يستدعي `window.electronAPI.dbQuery` مع INSERT في `activity_logs`.
- **يجب** استدعاؤها من الواجهة مع سياق المستخدم (من `useAuthStore`) عند كل إجراء يُراد تسجيله.

---

## 3. متى وكيف يُسجّل النشاط

### الموظفون

| الإجراء | module | action | entityType | التفاصيل |
|---------|--------|--------|------------|----------|
| أرشفة موظف | archive | archive | employee | `تمت أرشفة موظف: {الاسم} بواسطة {المستخدم}` |
| تحديث حالة (تغيير فعلي) | employee | status_change | employee | نص من UpdateStatusModal (الحالة الجديدة، الفرع، إلخ) |
| تصحيح تاريخ (بدون تغيير الحالة) | employee | date_correction | employee | نص يصف التصحيح |

- **مصدر التسجيل:** `EmployeeProfile` (أرشفة)، `UpdateStatusModal` (تحديث حالة، تصحيح تاريخ).

### الأفرع

| الإجراء | module | action | entityType | التفاصيل |
|---------|--------|--------|------------|----------|
| أرشفة فرع | archive | archive | branch | `تمت أرشفة فرع: {الاسم} بواسطة {المستخدم}` |
| تحديث انتهاء (رخصة، عقد إيجار، بطاقة منشأة) | branch | expiry_update | branch | `تحديث تاريخ انتهاء {الوثيقة} إلى {التاريخ}` |
| تحديث انتهاء عقد الإيجار | branch | expiry_update | branch | من `UpdateLeaseExpiryModal` مع تفاصيل الدفعات |

- **مصدر التسجيل:** `BranchProfile` (أرشفة)، `UpdateExpiryPopup` (عند تمرير activityLogParams من البروفايل)، `UpdateLeaseExpiryModal`.

### المركبات

| الإجراء | module | action | entityType | التفاصيل |
|---------|--------|--------|------------|----------|
| أرشفة مركبة | archive | archive | vehicle | `تمت أرشفة مركبة: {اللوحة} بواسطة {المستخدم}` |
| تعيين مسؤول المركبة | vehicle | assign_responsible | vehicle | `تعيين مسؤول المركبة: {الاسم} ({اللوحة})` |
| تحديث انتهاء (رخصة/تأمين) | vehicle | expiry_update | vehicle | من `UpdateExpiryPopup` |

- **مصدر التسجيل:** `VehicleProfile` (أرشفة)، `AssignResponsibleModal`، `UpdateExpiryPopup`.

### السكن

| الإجراء | module | action | entityType | التفاصيل |
|---------|--------|--------|------------|----------|
| تعيين ساكن | housing | assign_occupant | housing | `تعيين ساكن: {الاسم} ({الدور}) في {اسم الوحدة}` |
| تحديث انتهاء العقد | housing | expiry_update | housing | `تحديث تاريخ انتهاء العقد إلى {التاريخ}` |

- **مصدر التسجيل:** `AssignOccupantModal`، `UpdateHousingExpiryModal`.

### الكيانات الضريبية

| الإجراء | module | action | entityType | التفاصيل |
|---------|--------|--------|------------|----------|
| أرشفة كيان | archive | archive | entity | `تمت أرشفة كيان: {الاسم} بواسطة {المستخدم}` |

- **مصدر التسجيل:** `EntityProfile`.

### الأرشفة التلقائية (النظام)

- **المجدد:** Electron `runTerminatedArchiveScheduler` يعمل كل 24 ساعة.
- **الشرط:** موظف بحالة "إنهاء التعاقد" ومرّ أكثر من 7 أيام على تاريخ بدء الحالة.
- **الإجراء:** تحديث `employees.status` إلى `archived` ثم إدراج سجل في `activity_logs` مع `performedByUsername: 'النظام'` و`performedByUserId: NULL`.

### الاستعادة من الأرشيف

| الإجراء | module | action | entityType | التفاصيل |
|---------|--------|--------|------------|----------|
| استعادة من الأرشيف | archive | restore | employee/branch/vehicle/housing/entity | نص يصف الاستعادة |

- **مصدر التسجيل:** `Archive.tsx` عند النقر على "استعادة".

---

## 4. جدول سجل الحالات: `status_history`

### بنية الجدول

| العمود | النوع | الوصف |
|--------|--------|--------|
| `id` | INTEGER PK | المعرف |
| `entityType` | TEXT | حالياً: 'employee' فقط (قابل للتوسيع) |
| `entityId` | INTEGER | معرف الموظف |
| `status` | TEXT | الحالة: active, leave, suspended, inactive, seconded, visa_cancelled, terminated |
| `startDate` | TEXT | تاريخ بداية الحالة |
| `endDate` | TEXT | تاريخ نهاية الحالة (عند الانتقال لحالة أخرى) |
| `durationDays` | INTEGER | مدة الحالة بالأيام |
| `performedByUserId` | INTEGER | من غيّر الحالة |
| `performedByUsername` | TEXT | اسم المنفّذ |
| `performedByUserCode` | TEXT | (مضاف عبر migration) |
| `createdAt` | TEXT | وقت الإدراج |

**ملاحظة:** الجدول صُمّم عاماً (entityType + entityId) لكن الاستخدام الفعلي حالياً للموظفين فقط. جدول `employee_status_history` القديم استُبدل بنسخ بياناته إلى `status_history` عبر migration لمرة واحدة.

### آلية الكتابة

- **المصدر:** `UpdateStatusModal.tsx` فقط.
- عند **تغيير الحالة** فعلياً:
  1. إن وُجد سجل سابق مفتوح (بدون endDate): يُحدَّث `endDate` و`durationDays` لتاريخ الانتقال.
  2. يُدرج سجل جديد للحالة الجديدة مع `startDate` وبدون `endDate` (أو مع endDate إن كانت الحالة ذات نهاية محددة).
- عند **تصحيح التاريخ** فقط (بدون تغيير الحالة): يُحدَّث `startDate` و`durationDays` للسجل الحالي؛ ولا يُدرج سجل جديد.
- **لا يُستخدم** `status_history` للأفرع أو المركبات أو السكن — فقط للموظفين.

---

## 5. تبويب السجل (HistoryTab)

**المسار:** `src/components/shared/HistoryTab.tsx`

### الاستخدام

يُستدعى داخل بروفايل الفرع، الموظف، المركبة، والسكن:

```tsx
<HistoryTab entityType="branch" entityId={branchId} />
<HistoryTab entityType="employee" entityId={employeeId} entityName={employee.name} />
<HistoryTab entityType="vehicle" entityId={vehicleId} entityName={vehicle.plateNumber} />
<HistoryTab entityType="housing" entityId={unit.id} entityName={unit.name} />
```

- **الكيانات الضريبية** (EntityProfile) **لا تحتوي** على تبويب سجل — لا HistoryTab للكيانات.

### آلية التحميل

1. **للموظفين:**
   - استعلام `status_history` حيث `entityType = 'employee'` و `entityId = ?` مرتباً تنازلياً (حد 100).
   - تحويل كل صف إلى `HistoryRow` مع `type: 'status'` وعرض مخصّص حسب الحالة (يعمل، إجازة، متوقف، معار، إنهاء، إلخ).
   - إنشاء "سجل عمل الموظف" فرعي يركّز على الحالات المؤثرة في العمل (إجازة، متوقف، لا يعمل، عاد للعمل) مع عمود "المدة (يوم)" مثل "يعمل منذ 15 يوم" أو "إجازة منذ 23 يوم".
2. **لجميع الأنواع:**
   - استعلام `activity_logs` حيث `entityType = ?` و `entityId = ?` مرتباً تنازلياً (حد 100).
   - تحويل كل صف إلى `HistoryRow` مع `type: 'activity'`.
3. **الدمج والترتيب:** دمج الصفوف وترتيبها تنازلياً حسب التاريخ.

### واجهة التبويب

- **الموظفون فقط:** زرّان: "السجل العام" و"سجل عمل الموظف".
  - السجل العام: كل سجلات status + activity.
  - سجل عمل الموظف: سجلات status فقط (يعمل، إجازة، متوقف، لا يعمل) مع عرض المدة.
- **الأعمدة:** التاريخ، الإجراء، التفاصيل، المدة (للموظفين)، المستخدم.

### تسميات الإجراءات والعناصر

- **ACTION_LABELS:** status_change → تحديث حالة، date_correction → تصحيح تاريخ، expiry_update → تحديث وثيقة / تاريخ انتهاء العقد، assign_responsible → تعيين مسؤول المركبة، assign_occupant → تعيين ساكن، create → إضافة، edit → تعديل.
- **MODULE_LABELS:** employee → موظف، branch → فرع، vehicle → مركبة، housing → سكن، license → رخصة، lease → عقد إيجار، passport → جواز، contract → عقد عمل.

---

## 6. صفحة سجل النظام (Logs)

**المسار:** `src/pages/Logs.tsx`  
**المسار في التطبيق:** `/dashboard/logs`  
**الوصول:** من الشريط العلوي أو القائمة الجانبية — "سجل النظام".

### آلية العمل

1. **التحميل:** استعلام من `activity_logs` مرتباً تنازلياً بـ `LIMIT 1000`.
2. **تسمية العناصر:** لكل سجل له `entityId` يُجلب اسم العنصر من الجدول المناسب حسب `entityType`:
   - employee → `employees.name`
   - branch → `branches.name`
   - vehicle → `vehicles.plateNumber`
   - housing → `housings.name`
   - entity → `entities.name`
3. **البحث:** فلترة بالكلمة المفتاحية في: module, action, details, performedByUsername, performedByUserCode, entityName، وكذلك في التسميات العربية للأقسام والإجراءات.
4. **العرض:** جدول بالأعمدة: الوقت، القسم، العنصر، الإجراء، التفاصيل، المستخدم.

### تسميات الأقسام في الصفحة

- **MODULE_SECTION_LABELS:** employee → الموظفون، branch → الأفرع والمنشآت، vehicle → المركبات، housing → السكن، tax → الضرائب، entity → الكيانات.
- القيم غير المعرّفة (مثل archive) تُعرض كما هي.

---

## 7. حذف السجل عند حذف الكيان

- **الموظف:** عند الحذف النهائي يُحذف من `status_history` كل سجل حيث `entityType = 'employee'` و `entityId = employeeId`.
- **activity_logs:** لا يُحذف تلقائياً عند حذف أي كيان — السجلات تبقى للمراجعة (وإن أُزيح entityId بفعل الحذف، يظل السجل موجوداً مع entityId القديم).

---

## 8. التحسينات المُنفّذة (Phase A–C)

### تغطية التسجيل
- **تسجيل الإضافة والتعديل:** كل Add*Modal يسجّل `create`/`edit` عبر `logActivity` (الأفرع، الموظفون، المركبات، السكن، الهواتف، الكيانات الضريبية، أصحاب العمل).
- **تسجيل أصحاب العمل:** أرشفة/استعادة صاحب العمل تُسجَّل في `EmployerProfile`.
- **`performedByUserCode`:** يُملأ بـ `user.username` بشكل صحيح في كل الاستدعاءات.
- **توحيد القيم:** `MODULE_SECTION_LABELS` و`ACTION_LABELS` تشمل كل الأقسام والإجراءات.

### صفحة سجل النظام (Logs.tsx)
- **فلترة متقدمة:** حسب القسم، الإجراء، النطاق الزمني، + بحث نصي.
- **ترقيم صفحات:** 50 سجل/صفحة.
- **تصدير CSV:** زر تصدير ينشئ ملف CSV.
- **أيقونات وألوان:** أيقونة ولون لكل إجراء، بادج للقسم.
- **روابط تفاعلية:** النقر على اسم العنصر يفتح بروفايله.
- **ثنائي اللغة:** يتبع لغة الواجهة (عربي/إنجليزي) واتجاهها.

### تبويب السجل (HistoryTab)
- **عرض Timeline:** خط زمني عمودي مع نقاط ملونة وبطاقات.
- **تبديل الشكل:** زر تبديل بين Timeline وجدول.
- **ثنائي اللغة:** كل النصوص والتسميات تتبع لغة الواجهة.
- **بطاقة ملخص:** للموظف (الحالة الحالية + عدد السجلات).
- **دعم أصحاب العمل والكيانات:** إضافة `employer` و`entity` كأنواع مدعومة.

---

## 9. ملخص للمطور

| العنصر | الملف/الجدول |
|--------|----------------|
| دالة التسجيل | `src/utils/activityLog.ts` — `logActivity()` |
| جدول النشاط | `activity_logs` |
| جدول الحالات | `status_history` |
| تبويب السجل في البروفايل | `src/components/shared/HistoryTab.tsx` (Timeline + جدول) |
| صفحة سجل النظام | `src/pages/Logs.tsx` (فلترة، ترقيم، تصدير، أيقونات) |
| كتابة status_history | `UpdateStatusModal.tsx` فقط (للموظفين) |
| كتابة activity_logs | كل Add*Modal + Profile (أرشفة/استعادة) + UpdateExpiryPopup + المجدول التلقائي |
| مسار الصفحة | `/dashboard/logs` |
