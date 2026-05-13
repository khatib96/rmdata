# تنبيهات الصلاحية على البطاقات والقوائم — شرح تفصيلي

هذا المستند يشرح للمبرمج أو أداة الذكاء الاصطناعي كيف تظهر **تنبيهات الصلاحية** (انتهاء الوثائق والعقود) على **بطاقات** و**جداول** كل قسم: الموظفون، الأفرع، المركبات، السكن. يشمل منطق الحالة (ساري / تحذير / منتهي)، الألوان والأيقونات، ومصادر البيانات.

---

## 1. نظرة عامة

في كل قسم من الأقسام (موظفون، أفرع، مركبات، سكن) تُعرض للمستخدم:
- **في وضع البطاقات (Grid):** تحتوي كل بطاقة على قسم "تنبيهات الصلاحية" يعرض قائمة بنود (مثل جواز السفر، الرخصة، عقد الإيجار) مع حالة كل تاريخ انتهاء.
- **في وضع الجدول (List):** عمود بعنوان **"تنبيهات الصلاحية"** يعرض نفس البنود مع نفس المنطق.

الحالات الثلاث المستخدمة في الواجهة:
- **ساري (ok / green):** التاريخ بعد أكثر من 30 يوماً — لون أخضر، أيقونة صح.
- **تحذير (warning):** التاريخ خلال 30 يوماً أو أقل (أو يوم الانتهاء) — لون أصفر، أيقونة تحذير.
- **منتهي (expired):** التاريخ قد مرّ — لون أحمر، أيقونة خطر.

**ملاحظة:** قسم الموظفين يستخدم نظاماً من أربع درجات (أخضر، برتقالي، أصفر، أحمر) من خلال `expiryAlert.ts`؛ الأقسام الأخرى تستخدم ثلاث درجات (ok / warning / expired) إما بدالة محلية أو من `expiryStatus.ts`.

---

## 2. الدوال المساعدة المشتركة

### 2.1 نظام الموظفين: أربع درجات (`src/utils/expiryAlert.ts`)

| الدالة | الوصف |
|--------|--------|
| `getExpiryStatus(dateStr)` | يُرجع `ExpiryInfo`: status (green \| orange \| yellow \| red), label, icon, daysLeft, isExpired |
| `getExpiryBadgeClass(status)` | يُرجع كلاس CSS للشارة حسب الحالة |

**منطق الحالات:**
- **red:** `daysLeft < 0` → منتهي؛ أو `daysLeft <= 0` → ينتهي اليوم.
- **yellow:** `0 < daysLeft <= 30`.
- **orange:** `30 < daysLeft <= 90`.
- **green:** `daysLeft > 90` أو لا يوجد تاريخ.

**الأيقونات في الواجهة:** CheckCircle (أخضر)، AlertTriangle (أصفر/برتقالي)، AlertCircle (أحمر).

### 2.2 نظام ثلاث درجات (`src/utils/expiryStatus.ts`)

| الدالة | الوصف |
|--------|--------|
| `getExpiryStatus(dateStr)` | يُرجع `'expired' \| 'warning' \| 'ok'` |
| `getExpiryBadgeClass(status)` | كلاس للشارة: red → أحمر، warning → أصفر، ok → أخضر |

**منطق الحالات:**
- **expired:** `days < 0`.
- **warning:** `0 <= days <= 30`.
- **ok:** `days > 30`.

تُستخدم في **بروفايل الفرع** (أقسام الرخصة، العقد، المنشأة، الأقسام المخصصة). قوائم الأفرع والمركبات والسكن لا تستورد هذه الملف؛ لكل منها منطق محلي.

### 2.3 حساب الأيام المتبقية

النمط المستخدم في الأقسام:
```ts
function getDaysUntil(dateStr): number | null
  اليوم = تاريخ اليوم (منتصف الليل)
  الانتهاء = تاريخ الانتهاء (منتصف الليل)
  الأيام = ceil((انتهاء - اليوم) / يوم واحد)
```
- قيمة سالبة = انتهى منذ |x| يوم.
- صفر = ينتهي اليوم.
- موجبة = ينتهي بعد x يوم.

---

## 3. قسم الموظفون

**المصدر:** `src/components/Employees/Employees.tsx`  
**دالة الحالة:** `getExpiryStatus` من `expiryAlert.ts` (أربع درجات).

### البنود المعروضة على البطاقة/الجدول

يتم تجميعها في `getEmployeeExpiries(emp)`:

| الحقل في الموظف | التسمية المعروضة |
|------------------|-------------------|
| passportExpiry | جواز السفر |
| emiratesIdExpiry | الهوية الإماراتية |
| workCardExpiry | بطاقة العمل |
| contractExpiryDate | عقد العمل |
| loanExpiryDate | الإعارة |
| healthInsuranceExpiryDate | التأمين الصحي (إن كان healthInsuranceEnabled) |
| unemploymentInsuranceExpiryDate | تأمين التعطل عن العمل (إن كان unemploymentInsuranceEnabled) |

- البنود تُرتب بحيث الحالة **red** (منتهي) تظهر أولاً.

### العرض في البطاقة (Grid)

- تحت بيانات الموظف (الاسم، الوظيفة، الفرع، الهاتف) يوجد قسم بحد علوي رمادي.
- كل بند: أيقونة (CheckCircle / AlertTriangle / AlertCircle) + نص.
- **لون النص:** red → `text-alert-red`؛ yellow أو orange → `text-yellow-700`؛ green → `text-success-green`.
- **صيغ النص:**
  - منتهي: `{التسمية}: انتهى من {عدد الأيام} يوم`
  - ساري (أيام متبقية): `{التسمية}: ينتهي بعد {الأيام} يوم`
  - غير ذلك: `{التسمية}: {label}` (مثل "ينتهي اليوم"، "ساري").

### العرض في الجدول (List)

- عمود **"تنبيهات الصلاحية"** يعرض نفس قائمة البنود من `getEmployeeExpiries(emp)` بنفس الأيقونات والألوان وصيغ النص.

---

## 4. قسم الأفرع والمنشآت

**المصدر:** `src/components/Branches/Branches.tsx`  
**منطق الحالة:** محلي داخل الملف — `getDaysUntil` و`getAllExpiries(b, customAlerts)`.

### البنود المعروضة

تُجمَّع في `getAllExpiries(branch, customAlerts)`:

| المصدر | التسمية |
|--------|---------|
| licenseExpiry أو tradeLicenseExpiry | الرخصة التجارية |
| leaseExpiry | عقد الإيجار |
| establishmentExpiry أو establishmentCardExpiry | بطاقة المنشأة |
| branch_custom_fields (enableAlert=1 و alertDate) | عنوان القسم أو "قسم مخصص" |

- **customAlerts:** يُجلب من استعلام `branch_custom_fields` حيث `enableAlert = 1` و `alertDate IS NOT NULL`، ثم يُربط بـ branchId.

### منطق الحالة (أفرع)

```ts
daysUntil = getDaysUntil(date)
status = daysUntil <= 1 ? 'expired' : daysUntil <= 30 ? 'warning' : 'ok'
```

- **منتهي:** يوم الانتهاء أو بعده (daysUntil <= 1 يعامل "ينتهي اليوم" كتحذير قوي؛ في الكود الفعلي 0 يُعتبر warning و 1 أيضاً قد يُستخدم حسب الدقة — في getAllExpiries المعيار هو daysUntil <= 1 لـ expired).
- مراجعة الكود: `daysUntil < 0` → انتهى؛ `daysUntil === 0` → ينتهي اليوم؛ `daysUntil > 0` → ينتهي بعد x يوم. والحالة expired عند daysUntil <= 1 تعني أن "ينتهي غداً" أو اليوم أو الماضي = expired في بعض السياقات. في Branches.tsx السطر 141: `daysUntil <= 1 ? 'expired'` — إذن يوم الصفر (اليوم) يعتبر expired، ويوم 1 قد يكون warning في سياق آخر. نترك الوصف كما في الكود: expired عند <= 1، warning عند <= 30، ok غير ذلك.

### العرض في البطاقة

- قسم تحت بيانات الفرع (الصورة، الاسم، الإمارة، الهاتف) بحد علوي.
- كل بند: أيقونة (CheckCircle أخضر / AlertTriangle أصفر / AlertCircle أحمر) + نص.
- **صيغ النص:**
  - `daysUntil < 0`: `{التسمية}: انتهى من {|daysUntil|} يوم`
  - `daysUntil === 0`: `{التسمية}: ينتهي اليوم`
  - غير ذلك: `{التسمية}: ينتهي بعد {daysUntil} يوم`

### العرض في الجدول

- عمود **"تنبيهات الصلاحية"** يعرض حتى **4** بنود أولى من `getAllExpiries` (slice(0, 4)) بنفس التنسيق.

---

## 5. قسم المركبات

**المصدر:** `src/components/Vehicles/Vehicles.tsx`  
**منطق الحالة:** محلي — `getDaysUntil` و`getVehicleExpiries(v)`.

### البنود المعروضة

| الحقل | التسمية |
|-------|----------|
| licenseExpiryDate | رخصة المركبة |
| insuranceExpiryDate | تأمين المركبة |

### منطق الحالة (مركبات)

```ts
status = daysUntil <= 1 ? 'expired' : daysUntil <= 30 ? 'warning' : 'ok'
```

(نفس فكرة الأفرع: يوم الانتهاء أو الماضي = expired.)

### العرض في البطاقة والجدول

- البطاقة: قسم تحت بيانات المركبة (اللوحة، الماركة، المالك) يعرض البندين إن وُجدا.
- الجدول: عمود **"تنبيهات الصلاحية"** يعرض نفس البنود.
- الألوان: منتهي → أحمر، تحذير → أصفر، ساري → أخضر.
- صيغ النص: نفس أفرع (انتهى من x يوم / ينتهي اليوم / ينتهي بعد x يوم).

---

## 6. قسم السكن

**المصدر:** `src/components/Housing/Housing.tsx`  
**البنود:** تاريخ واحد فقط — **انتهاء عقد الإيجار** (`contractExpiry`).

### منطق الحالة

```ts
daysUntil = getDaysUntil(contractExpiry)
contractStatus = daysUntil == null ? 'ok' : daysUntil < 0 ? 'expired' : daysUntil <= 30 ? 'warning' : 'ok'
```

- لا تاريخ → ساري (ok).
- منتهي: أيام سالبة.
- تحذير: 0 إلى 30 يوم.

### العرض في البطاقة

- سطر واحد تحت اسم الوحدة ونوعها: "عقد: …" مع أيقونة ولون.
- **صيغ النص:** منتهي → "انتهى من {x} يوم"؛ تحذير → "ينتهي بعد {x} يوم"؛ ساري → "ساري".
- يلي ذلك سطر الدفعات (مدفوعة/المجموع) وعدد السكان إن وُجد.

### العرض في الجدول

- عمود **"انتهاء العقد"** يعرض التاريخ مع لون (أحمر عند منتهي، أصفر عند تحذير) ونص فرعي مثل "(انتهى)" أو "(بعد x يوم)" عند الحاجة.

---

## 7. الأيقونات والألوان الموحدة

| الحالة | الأيقونة (lucide-react) | لون النص (Tailwind) |
|--------|-------------------------|----------------------|
| ساري (ok / green) | CheckCircle | text-success-green |
| تحذير (warning / yellow / orange) | AlertTriangle | text-yellow-700 (أو yellow-600 للأيقونة) |
| منتهي (expired / red) | AlertCircle | text-alert-red |

- في الموظفين البرتقالي يُعامل مع الأصفر في اللون (نفس أصفر للعرض).

---

## 8. مصدر البيانات لكل قسم

| القسم | الجداول/الحقول |
|-------|-----------------|
| موظفون | employees: passportExpiry, emiratesIdExpiry, workCardExpiry, contractExpiryDate, loanExpiryDate, healthInsuranceExpiryDate, unemploymentInsuranceExpiryDate, healthInsuranceEnabled, unemploymentInsuranceEnabled |
| أفرع | branches + branch_licenses (expiryDate), branch_leases (expiryDate), branch_establishments (immigrationCardExpiryDate أو establishmentCardExpiry)، branch_custom_fields (enableAlert, alertDate, title) |
| مركبات | vehicles: licenseExpiryDate, insuranceExpiryDate |
| سكن | housing_units: contractExpiry |

---

## 9. ملخص للمطور

| العنصر | الموظفون | الأفرع | المركبات | السكن |
|--------|----------|--------|----------|--------|
| مكوّن القائمة | Employees.tsx | Branches.tsx | Vehicles.tsx | Housing.tsx |
| دالة الحالة | getExpiryStatus (expiryAlert) | getDaysUntil + status محلي | getDaysUntil + status محلي | getDaysUntil + contractStatus محلي |
| عدد البنود في الجدول | الكل | حتى 4 | 2 (رخصة، تأمين) | 1 (عقد) |
| عرض البطاقة | قائمة كل البنود | قائمة كل البنود | رخصة + تأمين | سطر واحد للعقد |

جميع الأقسام تعرض تنبيهات الصلاحية على البطاقات والجدول دون الاعتماد على جدول `notifications`؛ الحساب فوري من تواريخ الانتهاء المخزنة في جداول كل كيان. مركز التنبيهات (الجرس) يعتمد على جدول `notifications` الذي يُملأ من عملية Electron — راجع `docs/NOTIFICATIONS_AND_ALERTS.md`.
