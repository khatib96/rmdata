# نظام التنبيهات والتنبيهات — شرح تفصيلي

هذا المستند يشرح للمبرمج أو أداة الذكاء الاصطناعي كيف يعمل **نظام التنبيهات** في التطبيق: جدول التنبيهات، مصادره، واجهة مركز التنبيهات، وواجهات Electron (تحميل، تحديث، تحديد كمقروء، وحذف التنبيهات المقروءة).

---

## 1. نظرة عامة

نظام التنبيهات يوفّر:
- **تنبيهات تلقائية** ناتجة عن تواريخ انتهاء (رخص، عقود إيجار، تأمين، جوازات، إلخ) ودفعات إيجار قريبة، تُنشأ أو تُحدَّث من عملية Electron `notifications:ensureAllExpiryReminders` (وعند بدء التطبيق لدفعات الإيجار).
- **عرض التنبيهات** في واجهة **مركز التنبيهات** (NotificationCenter): زر جرس، عدد غير المقروءة، وقائمة التنبيهات مع إمكانية تحديد كمقروء والانتقال إلى البروفايل المرتبط.
- **تحديد كمقروء** فردي أو جماعي؛ **حذف تلقائي** للتنبيهات المقروءة بعد 24 ساعة من وقت القراءة (`readAt`).
- **ربط التنبيه بالكيان:** كل تنبيه مرتبط بـ `entityType` و `entityId` (وأحياناً `relatedField`) للانتقال إلى الفرع أو المركبة أو الموظف.

---

## 2. جدول التنبيهات: `notifications`

**الكيان في TypeORM:** `src/database/entities/Notification.ts`

| العمود | النوع | الوصف |
|--------|--------|--------|
| `id` | INTEGER PK | المعرف |
| `entityType` | VARCHAR(50) | نوع الكيان: branch, employee, vehicle, lease, … (انظر NotificationEntityType) |
| `entityId` | INTEGER | معرف السجل المرتبط (فرع، موظف، مركبة، أو leaseId لدفعات الإيجار) |
| `title` | VARCHAR(200) | عنوان التنبيه |
| `message` | TEXT | نص التنبيه |
| `dueDate` | DATE | تاريخ الاستحقاق/الانتهاء |
| `severity` | VARCHAR(20) | info \| warning \| danger |
| `isRead` | BOOLEAN | هل قُرئ |
| `readAt` | DATETIME | وقت تحديد التنبيه كمقروء — يُستخدم لحذف التنبيهات المقروءة بعد 24 ساعة |
| `isArchived` | BOOLEAN | أرشفة التنبيه |
| `relatedField` | VARCHAR(100) | حقل مرتبط (مثل passportExpiry، branch-license-123، vehicle-license، employee-contractExpiryDate) لتمييز مصدر التنبيه وتجنّب التكرار |
| `createdAt` | DATETIME | |

**الفهارس:** `(entityType, entityId)`, `dueDate`, `isRead`.

**قيم entityType المستخدمة في التنبيهات التلقائية:**
- `branch` — رخص فرع، عقود إيجار، منشأة، أقسام مخصصة، ودفعات إيجار (عند ربط التنبيه بالفرع).
- `vehicle` — رخصة مركبة، تأمين مركبة.
- `employee` — جواز، هوية، عقد، إعارة، تأمين صحي، تأمين تعطل، إلخ.
- `lease` — استحقاق دفعة إيجار (هنا `entityId` = `leaseId` من `branch_leases`؛ الواجهة تعرض التنبيه لكن الانتقال قد يكون للفرع المرتبط بعقد الإيجار).

---

## 3. مصادر التنبيهات التلقائية

يتم إنشاء/تحديث سجلات التنبيهات في **Electron** ضمن المعالج `notifications:ensureAllExpiryReminders` (ويُستدعى عند فتح مركز التنبيهات من الواجهة). نافذة الزمن المستخدمة: **اليوم حتى اليوم + 90 يوماً** للانتهاءات، و**7 أيام** لاستحقاق دفعات الإيجار.

### 3.1 دفعات الإيجار (استحقاق خلال 7 أيام)

- **المصدر:** `lease_installments` + `branch_leases` + `branches`.
- **الشروط:** `dueDate` بين اليوم واليوم + 7 أيام.
- **الحفظ:** `entityType = 'branch'`, `entityId = branchId`, `relatedField = 'installment-{id}'`, عنوان "استحقاق دفعة إيجار"، و`severity = 'info'`.

### 3.2 انتهاء صلاحيات الفروع (ضمن 90 يوماً)

| المصدر | الجدول | relatedField | عنوان نموذجي |
|--------|--------|--------------|---------------|
| رخص الفرع | branch_licenses | branch-license-{id} | الرخصة (الاسم التجاري): انتهاء / انتهت |
| عقد إيجار الفرع | branch_leases | branch-lease-{id} | عقد الإيجار: انتهاء / انتهى |
| بطاقة المنشأة | branch_establishments | branch-establishment-{id} | بطاقة المنشأة: انتهاء / انتهت |
| أقسام مخصصة الفرع | branch_custom_fields | branch-custom-{id} | [عنوان القسم]: انتهاء / انتهى |

- **الحفظ:** `entityType = 'branch'`, `entityId = branchId`.
- **severity:** حسب الأيام المتبقية: منتهي → danger، ≤ 30 يوم → warning، غير ذلك → info.

### 3.3 المركبات (ضمن 90 يوماً)

- **رخصة المركبة:** `licenseExpiryDate` → `relatedField = 'vehicle-license-{id}'`, عنوان "رخصة المركبة: انتهاء" أو "انتهت".
- **تأمين المركبة:** `insuranceExpiryDate` → `relatedField = 'vehicle-insurance-{id}'`.
- **حقول مخصصة:** `vehicle_custom_fields` حيث `enableAlert = 1` → `relatedField = 'vehicle-custom-{id}'`.
- **الحفظ:** `entityType = 'vehicle'`, `entityId = vehicle.id`.

### 3.4 الموظفون (ضمن 90 يوماً)

الحقول المُفحوصة من جدول `employees` مع تسميات التنبيه:

- `passportExpiry` → جواز السفر → `relatedField = 'employee-passport-{id}'`
- `emiratesIdExpiry` → الهوية الإماراتية → `relatedField = 'employee-emiratesId-{id}'`
- `workCardExpiry` → بطاقة العمل → `relatedField = 'employee-workCard-{id}'`
- `contractExpiryDate` → عقد العمل → `relatedField = 'employee-contract-{id}'`
- `loanExpiryDate` → الإعارة → `relatedField = 'employee-loan-{id}'`
- `healthInsuranceExpiryDate` → التأمين الصحي → `relatedField = 'employee-healthInsurance-{id}'`
- `unemploymentInsuranceExpiryDate` → تأمين التعطل → `relatedField = 'employee-unemployment-{id}'`

- **الحفظ:** `entityType = 'employee'`, `entityId = employee.id`.
- **severity:** نفس منطق الأيام (danger / warning / info).

### 3.5 السكن (ضمن 90 يوماً)

- **عقد إيجار السكن:** `housing_units.contractExpiry` → `relatedField = 'housing-contract-{id}'`.
- **حقول مخصصة:** `housing_custom_fields` حيث `enableAlert = 1` → `relatedField = 'housing-custom-{id}'`.
- **الحفظ:** `entityType = 'housing'`, `entityId = housing_units.id`.

### 3.6 أصحاب العمل (ضمن 90 يوماً)

- `passportExpiry` → جواز السفر → `relatedField = 'employer-passport-{id}'`
- `emiratesIdExpiry` → الهوية الإماراتية → `relatedField = 'employer-emiratesId-{id}'`
- **الحفظ:** `entityType = 'employer'`, `entityId = employer.id`.

### 3.7 الكيانات الضريبية (ضمن 90 يوماً)

- `tradeLicenseExpiry` → الرخصة التجارية → `relatedField = 'entity-tradeLicense-{id}'`
- **الحفظ:** `entityType = 'entity'`, `entityId = entity.id`.

### 3.8 دالة upsert في Electron

لتجنّب تكرار التنبيه لنفس المصدر: إذا وُجد سجل بنفس `(entityType, entityId, relatedField)` يتم **تحديث** العنوان والرسالة وتاريخ الاستحقاق والـ severity؛ وإلا **إدراج** سجل جديد.

### 3.9 التحقق من إعداد التنبيهات

عند استدعاء `ensureAllExpiryReminders`، يتم أولاً قراءة إعداد `notificationsEnabled` من جدول `settings`؛ إذا كانت قيمته `'0'` يتم تخطي إنشاء التنبيهات بالكامل.

### 3.10 تنبيهات دفعات الإيجار عند بدء التطبيق

عند **تهيئة قاعدة البيانات** في Electron يُنفَّذ مرة واحدة استعلام لدفعات الإيجار خلال 7 أيام وإدراج تنبيهات من نوع `entityType = 'lease'`, `entityId = leaseId`, `relatedField = 'installment-{id}'`. بعد ذلك يُستدعى `notifications:ensureAllExpiryReminders` عند فتح مركز التنبيهات في الواجهة، والذي يتضمن أيضاً دفعات الإيجار (مع ربطها بـ branch في الكود الحالي). معالج منفصل `notifications:ensureLeaseReminders` يُستدعى بعد حفظ عقد إيجار/دفعات من واجهة الأفرع لضمان وجود تنبيهات للدفعات القريبة.

---

## 4. واجهة مركز التنبيهات (NotificationCenter)

**المسار:** `src/components/Layout/NotificationCenter.tsx`

### التحميل والعرض

- عند **فتح** اللوحة (أو عند التحكم الخارجي بـ `externalOpen`): يُستدعى أولاً `notificationsEnsureAllExpiryReminders` ثم `notificationsLoad`.
- **notificationsLoad** (في Electron): يحدّث `readAt` للتنبيهات المقروءة التي لم يُضف لها `readAt`، ويحذف التنبيهات المقروءة التي مرّ على `readAt` أكثر من 24 ساعة، ثم يُرجع قائمة التنبيهات (غير المؤرشفة أو حسب منطق الاستعلام).
- القائمة تُعرض مع: العنوان، الرسالة، تاريخ الاستحقاق، أيقونة الشدة (info / warning / danger)، وحالة المقروء.

### تحديد كمقروء

- **واحد:** زر على كل تنبيه غير مقروء → استدعاء `notificationsMarkRead(id)`؛ في Electron: UPDATE `isRead = 1`, `readAt = now()`.
- **الكل:** زر "تحديد الكل كمقروء" → `notificationsMarkAllRead`؛ في Electron: UPDATE كل التنبيهات غير المؤرشفة إلى مقروء مع `readAt = now()`.

### النقر على التنبيه والانتقال

- **getNavigatePath:** حسب `entityType`:  
  - `branch` → `/dashboard/branches/{entityId}`  
  - `vehicle` → `/dashboard/vehicles/{entityId}`  
  - `employee` → `/dashboard/employees/{entityId}`  
  - `housing` → `/dashboard/housing/{entityId}`  
  - `employer` → `/dashboard/employers/{entityId}`  
  - `entity` → `/dashboard/entities/{entityId}`  
  - غير ذلك → لا مسار؛ لا انتقال.
- عند النقر: إن كان التنبيه غير مقروء يُحدَّد كمقروء ثم يُغلق المركز ويتم التوجيه إلى المسار أعلاه.

### الشدة والألوان

- **danger:** أحمر — انتهى / خطر.
- **warning:** أصفر — تحذير (مثلاً خلال 30 يوم).
- **info:** أخضر — معلومات (مثلاً خلال 90 يوم).
- المقروء: نمط محايد (أبيض/رمادي).

### عرض الزر (FAB)

- زر الجرس ثابت (مثلاً أسفل يسار الشاشة) مع عداد لعدد غير المقروءة؛ يمكن إخفاؤه عند التحكم من خارج المكوّن (مثل هيدر الموبايل) عبر `externalOpen` و `onExternalOpenChange`.

---

## 5. واجهات Electron (IPC)

**التعاريف في:** `src/types/electron.d.ts`  
**التنفيذ في:** `electron/main.ts`

| الواجهة | الوظيفة |
|---------|----------|
| `notificationsLoad` | تحديث readAt للمقروءة، حذف المقروءة الأقدم من 24 ساعة، ثم إرجاع قائمة التنبيهات |
| `notificationsEnsureLeaseReminders` | إنشاء تنبيهات لدفعات الإيجار خلال 7 أيام (يُستدعى بعد حفظ عقد/دفعات من واجهة الأفرع) |
| `notificationsEnsureAllExpiryReminders` | إنشاء/تحديث كل تنبيهات الانتهاء (فروع، مركبات، موظفين، دفعات إيجار) كما في الفقرة 3 |
| `notificationsMarkRead(id)` | تحديد تنبيه واحد كمقروء (isRead, readAt) |
| `notificationsMarkAllRead` | تحديد كل التنبيهات غير المؤرشفة كمقروءة |
| `notificationsDelete(id)` | حذف تنبيه واحد |
| `notificationsArchive(id)` | أرشفة تنبيه (isArchived = 1) |

---

## 6. حذف التنبيهات عند حذف/أرشفة الكيان

- عند **أرشفة مركبة:** حذف كل السجلات من `notifications` حيث `entityType = 'vehicle'` و `entityId = vehicleId`.
- عند **أرشفة موظف:** حذف كل السجلات من `notifications` حيث `entityType = 'employee'` و `entityId = employeeId`.
- عند **أرشفة فرع:** حذف كل السجلات من `notifications` حيث `entityType = 'branch'` و `entityId = branchId`.
- عند **أرشفة كيان ضريبي:** حذف كل السجلات من `notifications` حيث `entityType = 'entity'` و `entityId = entityId`.
- عند **أرشفة صاحب عمل:** حذف كل السجلات من `notifications` حيث `entityType = 'employer'` و `entityId = employerId`.

---

## 7. أنواع الواجهة (Frontend)

**المصدر:** `src/types/shared.ts`

- **NotificationSeverity:** info, warning, danger.
- **NotificationItem:** id, entityType, entityId, title, message?, dueDate?, severity, isRead, relatedField?, createdAt — تُستخدم في قائمة مركز التنبيهات دون استيراد TypeORM.

---

## 8. ملخص للمطور

| العنصر | الملف/الموقع |
|--------|----------------|
| كيان التنبيه | `src/database/entities/Notification.ts` |
| أنواع الواجهة | `src/types/shared.ts` (NotificationItem, NotificationSeverity) |
| مركز التنبيهات | `src/components/Layout/NotificationCenter.tsx` |
| إنشاء/تحديث تنبيهات الانتهاء | `electron/ipc/notifications-ipc.ts` → `notifications:ensureAllExpiryReminders` (أفرع + موظفون + مركبات + سكن + أصحاب عمل + كيانات ضريبية + حقول مخصصة) |
| تنبيهات دفعات الإيجار | `notifications:ensureLeaseReminders` + تهيئة عند البدء |
| تحميل وتنظيف | `notifications:load` (حذف المقروءة بعد 24 ساعة) |
| تحديد كمقروء | `notifications:markRead`, `notifications:markAllRead` |
| الانتقال من التنبيه | branch → بروفايل الفرع؛ vehicle → بروفايل المركبة؛ employee → بروفايل الموظف؛ housing → بروفايل السكن؛ employer → بروفايل صاحب العمل؛ entity → بروفايل الكيان الضريبي |
