# قسم المركبات — شرح تفصيلي

هذا المستند يشرح للمبرمج أو أداة الذكاء الاصطناعي كيف يعمل **قسم المركبات** في النظام: بنية البيانات، الأنواع، الملكية، الرخصة والتأمين، الربط بالفرع ومسؤول المركبة، الأقسام المخصصة والتنبيهات، المستندات، والسجل.

---

## 1. نظرة عامة

قسم المركبات يدير:
- **البيانات الأساسية**: لوحة، نوع مركبة، ملكية، ماركة/موديل/سنة، مكان الإصدار، أرقام الشاسيه والمحرك.
- **الرخصة**: تاريخ التسجيل وتاريخ الانتهاء — يُستخدم للتنبيهات تلقائياً.
- **التأمين**: شركة التأمين، نوع التأمين (شامل / ضد الغير)، رقم البوليصة، تاريخ انتهاء التأمين — يُستخدم للتنبيهات.
- **الفرع**: ربط المركبة بفرع (اختياري).
- **مسؤول المركبة**: موظف معيّن أو اسم مسؤول يدوي.
- **أقسام مخصصة**: حقول وتواريخ إضافية مع إمكانية تفعيل تنبيه (عرض في البروفايل فقط؛ لا يُنشأ سجل في جدول التنبيهات من عملية مركزية حالياً).
- **المستندات**: رخصة، تأمين، وثائق إضافية.
- **السجل**: تبويب سجل التغييرات (`status_history` حسب `entityType = 'vehicle'`).

---

## 2. الكيانات والجداول

### الجدول الرئيسي: `vehicles`

| العمود | النوع | الوصف |
|--------|--------|--------|
| `id` | INTEGER PK | المعرف |
| `code` | VARCHAR(20) | كود المركبة (مثل RMV0001) — فريد، يُولّد تلقائياً |
| `photoPath` | VARCHAR(255) | مسار صورة المركبة |
| `plateNumber` | VARCHAR(50) | رقم اللوحة — فريد |
| `plateCode` | VARCHAR(20) | كود اللوحة (أ، د، ...) |
| `vehicleName` | VARCHAR(200) | اسم/وصف المركبة |
| `brand` | VARCHAR(100) | الماركة |
| `model` | VARCHAR(100) | الموديل |
| `year` | INTEGER | سنة الصنع |
| `vehicleType` | VARCHAR(20) | نوع المركبة: bus, pickup, suv, sedan |
| `ownershipType` | VARCHAR(20) | نوع الملكية: company, personal |
| `ownerName` | VARCHAR(200) | اسم المالك (مهم عند الملكية الشخصية) |
| `issuePlace` | VARCHAR(100) | مكان إصدار اللوحة |
| `trafficNo` | VARCHAR(100) | رقم المرور |
| `chassisNo` | VARCHAR(100) | رقم الشاسيه |
| `engineNo` | VARCHAR(100) | رقم المحرك |
| `licenseRegDate` | DATE | تاريخ تسجيل الرخصة |
| `licenseExpiryDate` | DATE | تاريخ انتهاء الرخصة — **مصدر تنبيه** |
| `insuranceCompany` | VARCHAR(200) | شركة التأمين |
| `insuranceExpiryDate` | DATE | تاريخ انتهاء التأمين — **مصدر تنبيه** |
| `insuranceType` | VARCHAR(50) | comprehensive \| third_party |
| `insurancePolicyNo` | VARCHAR(100) | رقم بوليصة التأمين |
| `branchId` | INTEGER | الفرع المرتبط (FK → branches) |
| `responsibleEmployeeId` | INTEGER | مسؤول المركبة (موظف) |
| `responsibleName` | VARCHAR(200) | اسم المسؤول (يدوي عند عدم ربط موظف) |
| `status` | VARCHAR(50) | active \| archived |
| `createdAt`, `updatedAt` | DATETIME | |

### جدول الأقسام المخصصة: `vehicle_custom_fields`

| العمود | الوصف |
|--------|--------|
| `id` | PK |
| `vehicleId` | FK → vehicles |
| `title` | عنوان القسم |
| `content` | JSON: مصفوفة صفوف (key, value, isDate, enableAlert, alertDate, daysBeforeExpiry) |
| `enableAlert` | تفعيل تنبيه (0/1) |
| `alertDate` | تاريخ التنبيه (يُعرض في البروفايل؛ لا يُضاف تلقائياً لجدول notifications من main) |
| `daysBeforeExpiry` | عدد الأيام قبل الانتهاء (اختياري) |

---

## 3. الثوابت (Constants)

**المصدر:** `src/constants/vehicles.ts`

- **أنواع المركبات (VEHICLE_TYPES):** bus → باص، pickup → بيك أب، suv → دفع رباعي، sedan → سيدان.
- **أنواع الملكية (OWNERSHIP_TYPES):** company → شركة، personal → شخصي.
- **أنواع التأمين (INSURANCE_TYPES):** comprehensive → شامل، third_party → ضد الغير.
- **قائمة الماركات (VEHICLE_BRANDS):** تويوتا، نيسان، هيونداي، … (ثابتة قابلة للتوسيع).

---

## 4. واجهات المستخدم

### قائمة المركبات (`Vehicles.tsx`)

- عرض المركبات النشطة (غير المؤرشفة) مع إمكانية فلترة وبحث.
- عمود اللوحة: قد يُعرض تركيب `issuePlace + plateCode + plateNumber`.
- عرض حالة انتهاء الرخصة والتأمين (منتهي / تحذير / طبيعي) حسب التاريخ الحالي ونافذة 90 يوماً.
- زر إضافة مركبة يفتح `AddVehicleModal`.

### إضافة/تعديل مركبة (`AddVehicleModal.tsx`)

- **وضع الإضافة:** إنشاء سجل في `vehicles` ثم حفظ الأقسام المخصصة في `vehicle_custom_fields` والمستندات عبر `documentSave`.
- **وضع التعديل:** `editVehicleId` — تحميل المركبة، الأقسام المخصصة، وتحديث نفس الجداول.
- الحقول: اللوحة (رقم + كود + مكان إصدار)، الاسم، الماركة/الموديل/السنة، نوع المركبة، نوع الملكية، اسم المالك، أرقام الشاسيه والمحرك والمرور، تواريخ الرخصة، بيانات التأمين، الفرع.
- **أقسام مخصصة:** أقسام بعنوان وصفوف (نص/تاريخ)، مع خيار "تفعيل تنبيه" وتاريخ تنبيه لكل صف تاريخي؛ يُحفظ المحتوى كـ JSON في `content` وقيم `enableAlert` و `alertDate` في نفس الجدول.
- المستندات تُربط بـ `entityType: 'vehicle'`, `entityId: vehicleId`, و`section` حسب النوع (مثلاً license, insurance).

### بروفايل المركبة (`VehicleProfile.tsx`)

- **تبويبات:** أساسي، رخصة وتأمين، موافقات إضافية (أقسام مخصصة)، سجل، مستندات.
- **أساسي:** عرض كل البيانات الأساسية + الفرع + مسؤول المركبة.
- **رخصة وتأمين:** عرض تواريخ الانتهاء مع أزرار "تحديث انتهاء" تفتح `UpdateExpiryPopup` مع ربط المستند (`documentConfig`: entityType vehicle, section license / insurance).
- **موافقات إضافية:** عرض أقسام `vehicle_custom_fields`؛ إن وُجد `enableAlert` و `alertDate` يُعرض نص مثل "تنبيه قبل: [تاريخ]" — التنبيه هنا للعرض فقط ولا يُنشأ من عملية مركزية في Electron.
- **تعيين مسؤول:** `AssignResponsibleModal` — اختيار موظف من القائمة أو إدخال اسم مسؤول يدوي؛ يُحدَّث `responsibleEmployeeId` و `responsibleName`.
- **المستندات:** رخصة، تأمين، وأقسام أخرى؛ رفع وعرض وحذف عبر نظام المستندات.
- **السجل:** `HistoryTab` مع `entityType="vehicle"` و `entityId=vehicleId`.
- **أرشفة:** تحديث `status` إلى `archived` وتسجيل في `activity_logs`؛ عند الأرشفة يُحذف من جدول `notifications` كل سجل `entityType = 'vehicle'` و `entityId = vehicleId`.
- عند الحذف النهائي: حذف `vehicle_custom_fields` ثم `vehicles` (والمستندات حسب سياسة التطبيق).

---

## 5. التنبيهات التلقائية للمركبات

يتم إنشاء تنبيهات **الرخصة** و**التأمين** من عملية Electron `notifications:ensureAllExpiryReminders`:

- تُجلب المركبات غير المؤرشفة التي لها `licenseExpiryDate` أو `insuranceExpiryDate` ضمن 90 يوماً من اليوم.
- لكل رخصة منتهية أو قريبة: إدراج/تحديث سجل في `notifications` مع `entityType = 'vehicle'`, `entityId = vehicle.id`, `relatedField = 'vehicle-license'`، وعنوان مثل "رخصة المركبة: انتهاء" أو "انتهت"، و`severity` حسب الأيام (danger / warning / info).
- نفس المنطق لتأمين المركبة مع `relatedField = 'vehicle-insurance'`.

**ملاحظة:** حقول الأقسام المخصصة للمركبة (`vehicle_custom_fields.enableAlert`, `alertDate`) لا تُضاف حالياً إلى جدول `notifications` من هذه العملية؛ التنبيه يظهر فقط داخل بروفايل المركبة في قسم "موافقات إضافية".

---

## 6. المستندات

- **نوع الكيان:** `vehicle`.
- **أقسام شائعة:** `license`, `insurance`، وأي أقسام أخرى تُمرَّر من واجهة المستندات.
- المسار النسبي يتبع نمط مثل: `Vehicles/{vehicleId}/{section}/...`.
- ربط المستند بالتحديث يتم عبر `UpdateExpiryPopup` مع `documentConfig: { entityType: 'vehicle', entityId, section }`.

---

## 7. السجل والنشاط

- **سجل التغييرات:** `HistoryTab` يقرأ من `status_history` حيث `entityType = 'vehicle'` و `entityId = vehicleId`.
- **سجل النشاط:** الأرشفة تُسجّل في `activity_logs` مع `module: 'archive'`, `entityType: 'vehicle'`, `entityId: vehicleId`.

---

## 8. ملخص للمطور

| العنصر | الملف/الجدول |
|--------|----------------|
| كيان المركبة | `src/database/entities/Vehicle.ts` |
| حقول مخصصة | `vehicle_custom_fields`, `VehicleCustomField.ts` |
| ثوابت الأنواع | `src/constants/vehicles.ts` |
| قائمة المركبات | `src/components/Vehicles/Vehicles.tsx` |
| إضافة/تعديل | `src/components/Vehicles/AddVehicleModal.tsx` |
| البروفايل | `src/components/Vehicles/VehicleProfile.tsx` |
| تعيين المسؤول | `src/components/Vehicles/AssignResponsibleModal.tsx` |
| تحديث انتهاء | `UpdateExpiryPopup` مع documentConfig للمركبة |
| تنبيهات تلقائية | `electron/main.ts` → `notifications:ensureAllExpiryReminders` (رخصة وتأمين فقط) |
