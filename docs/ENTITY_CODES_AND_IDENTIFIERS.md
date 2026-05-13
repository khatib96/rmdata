# نظام المعرفات (Entity Codes) — شرح تفصيلي

هذا المستند يشرح للمبرمج أو أداة الذكاء الاصطناعي نظام **المعرفات التلقائية** المستخدم في التطبيق: البادئات (RMB, RME, RMV, RMH)، آلية التوليد، التعيين الرجعي للسجلات القديمة، والاستخدام في الواجهات والسجلات.

---

## 1. نظرة عامة

النظام يعتمد على **معرفات قياسية** لكل نوع كيان:
- **RMB** — فروع (Branches)
- **RME** — موظفون (Employees)
- **RMV** — مركبات (Vehicles)
- **RMH** — وحدات سكن (Housing)

**الصيغة:** `PREFIX + 4 أرقام`، مثل:
- RMB0001، RMB0002، ...
- RME0001، RME0002، ...
- RMV0001، RMV0002، ...
- RMH0001، RMH0002، ...

- المعرف **فريد** ولا يتكرر ضمن نفس الجدول.
- المعرف **دائم** — لا يُغيَّر بعد التعيين، ويُستخدم في القوائم والأرشيف والسجل.

---

## 2. الجداول والأعمدة

| الجدول | العمود | البادئة | مثال |
|--------|--------|---------|------|
| branches | code | RMB | RMB0001 |
| employees | code | RME | RME0001 |
| vehicles | code | RMV | RMV0001 |
| housing_units | code | RMH | RMH0001 |

- نوع العمود: `VARCHAR(20)`.
- يمكن أن يكون `NULL` لسجلات قديمة قبل تطبيق النظام؛ يتم التعامل معها عبر التعيين الرجعي.

**الكيانات الضريبية (entities):** لا تملك حقل `code` — تُعرّف بـ `id` فقط.

---

## 3. آلية توليد المعرف

**المصدر:** `src/utils/entityCode.ts`

### الدالة: `generateNextCode(prefix, table, dbQuery)`

```ts
// الاستعلام: آخر سجل له code يبدأ بالبادئة
SELECT code FROM {table} WHERE code IS NOT NULL AND code LIKE '{prefix}%' ORDER BY id DESC LIMIT 1
```

- تستخرج الرقم من `code` (مثلاً RMB0042 → 42).
- تحسب `nextNum = maxNum + 1`.
- تُرجع `prefix + String(nextNum).padStart(4, '0')` (مثل RMB0043).

### ملاحظات

- الدالة تبحث في **كل** السجلات التي تبدأ بـ البادئة، لا في آخر سجل فقط، لتجنب التداخل عند الحذف أو الترقيم غير المتسلسل.
- يُفترض أن `dbQuery` يمرّر الاستعلام إلى Electron/قاعدة البيانات.

---

## 4. متى يُعيَّن المعرف

### إضافة سجل جديد

- **فرع:** `AddBranchModal` — عند الإدراج يُستدعى `generateNextCode('RMB', 'branches', ...)` ويُمرَّر إلى INSERT.
- **موظف:** `AddEmployeeModal` — `generateNextCode('RME', 'employees', ...)` عند الإدراج.
- **مركبة:** `AddVehicleModal` — `generateNextCode('RMV', 'vehicles', ...)` عند الإدراج.
- **وحدة سكن:** `AddHousingModal` — `generateNextCode('RMH', 'housing_units', ...)` عند الإدراج.

### التعديل

- عند **تعديل** سجل (فرع، موظف، مركبة، وحدة سكن) **لا يتم تغيير** المعرف — يبقى كما هو.

---

## 5. التعيين الرجعي (Backfill)

عند تشغيل التطبيق لأول مرة أو بعد إضافة عمود `code`، يُعيَّن المعرف تلقائياً للسجلات التي ليس لها `code`:

### Electron (main.ts) — branches و employees

- يتحقق من وجود عمود `code` في `branches` و `employees`؛ إن لم يكن موجوداً يُضاف.
- يجلب السجلات مرتبة حسب `id` تصاعدياً.
- لكل سجل بدون `code` (أو بقيمة فارغة): `RMB0001`، `RMB0002`، ... و `RME0001`، `RME0002`، ... حسب ترتيب `id`.
- يُنشئ فهرساً فريداً:
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_code ON branches(code) WHERE code IS NOT NULL`
  - `CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_code ON employees(code) WHERE code IS NOT NULL`

### Migration: vehicles (ensure-vehicle-columns.ts)

- يُضاف عمود `code` إن لم يكن موجوداً.
- يجلب أقصى رقم من السجلات التي لها `code LIKE 'RMV%'`.
- لكل سجل بدون `code`: يُعيّن `RMV0001`، `RMV0002`، ... بشكل تسلسلي.

### Migration: housing_units (ensure-housing-columns.ts)

- نفس المنطق مع البادئة `RMH`.

---

## 6. العرض في الواجهة

### القوائم والبطاقات

- في قوائم الموظفين، الأفرع، المركبات، ووحدات السكن يُعرض المعرف بجانب الاسم أو اللوحة:
  - مثال: `أحمد محمد (RME0012)` أو `الفرع الرئيسي (RMB0001)`.
- النمط: `font-mono` للتمييز البصري.

### البروفايل

- في بروفايل كل كيان يُعرض المعرف في مكان بارز (مثلاً تحت العنوان أو بجانب الاسم).
- عند الأرشفة أو في السجل يُستخدم الاسم أو المعرف كـ "label" للعنصر.

### الأرشيف

- في صفحة الأرشيف يُستخدم `name || code || 'عنصر {id}'` لعرض اسم العنصر في القائمة.
- للموظفين: `name || code`؛ للأفرع: `name || code`؛ للمركبات: `plateNumber` و `code` معاً.

### البحث والفلترة

- في نوافذ اختيار الموظف (مثل تعيين ساكن، تعيين مسؤول مركبة) يُمكن البحث بالاسم أو بالمعرف (`e.code`).

---

## 7. السجل و performedByUserCode

في جدول `activity_logs` يوجد عمود `performedByUserCode`:

- يُستخدم لعرض "من نفّذ الإجراء" بشكل أوضح (مثلاً: الاسم + المعرف).
- القيمة المُخزنة تختلف حسب المكوّن:
  - أحياناً: `user.entityId` (رقم الموظف المرتبط بالمستخدم) كـ string.
  - أحياناً: `user.code` (معرف الموظف مثل RME0001) إن وُجد في كائن المستخدم.

**عرض المستخدم في سجل النظام:**  
`{performedByUsername} (performedByUserCode أو performedByUserId)` — مثل "أحمد محمد (RME0012)".

---

## 8. الثوابت والصادرات

من `entityCode.ts`:

```ts
export { PREFIX_BRANCH, PREFIX_EMPLOYEE, PREFIX_VEHICLE, PREFIX_HOUSING };
// القيم: 'RMB', 'RME', 'RMV', 'RMH'
```

---

## 9. ملخص للمطور

| العنصر | الملف/الموقع |
|--------|----------------|
| دالة التوليد | `src/utils/entityCode.ts` — `generateNextCode()` |
| البادئات | RMB, RME, RMV, RMH |
| التعيين الرجعي للأفرع والموظفين | `electron/main.ts` (عند تهيئة DB) |
| التعيين الرجعي للمركبات | `ensure-vehicle-columns.ts` |
| التعيين الرجعي للسكن | `ensure-housing-columns.ts` |
| استخدام التوليد عند الإضافة | AddBranchModal, AddEmployeeModal, AddVehicleModal, AddHousingModal |
| الفهارس الفريدة | `idx_branches_code`, `idx_employees_code` (على code WHERE code IS NOT NULL) |
