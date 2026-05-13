# خطة تحسين نظام التنبيهات (الجرس)

---

## 1. الحالة الحالية (بعد التنفيذ)

نظام التنبيهات المركزي (`notifications:ensureAllExpiryReminders`) **مربوط بجميع الأقسام** التالية:

| القسم | الحقول المراقبة | الحالة |
|-------|----------------|--------|
| الأفرع — رخص | `branch_licenses.expiryDate` | ✅ مربوط |
| الأفرع — عقد إيجار | `branch_leases.expiryDate` | ✅ مربوط |
| الأفرع — دفعات إيجار | `lease_installments.dueDate` (7 أيام) | ✅ مربوط |
| الأفرع — بطاقة المنشأة + GDRFA | `branch_establishments` | ✅ مربوط |
| الأفرع — حقول مخصصة | `branch_custom_fields.alertDate` | ✅ مربوط |
| الموظفون | 7 حقول (جواز، هوية، بطاقة عمل، تأمين صحي، عقد، إعارة، تأمين تعطل) | ✅ مربوط |
| المركبات | رخصة + تأمين + حقول مخصصة | ✅ مربوط |
| السكن | عقد إيجار + حقول مخصصة | ✅ مربوط |
| أصحاب العمل | جواز + هوية إماراتية | ✅ مربوط |
| الكيانات الضريبية | رخصة تجارية | ✅ مربوط |

**الهواتف:** لا توجد حقول انتهاء في النظام.

---

## 2. جميع حقول الانتهاء في النظام

### الأفرع (Branches)

| الجدول | الحقل | الوصف | relatedField |
|--------|-------|-------|-------------|
| `branch_licenses` | `expiryDate` | رخصة تجارية | `branch-license-{id}` |
| `branch_leases` | `expiryDate` | عقد إيجار | `branch-lease-{id}` |
| `branch_establishments` | `immigrationCardExpiryDate` | بطاقة المنشأة | `branch-establishment-{id}` |
| `branch_establishments` | `gdrfaExpiryDate` | GDRFA | `branch-gdrfa-{id}` |
| `branch_custom_fields` | `alertDate` | حقل مخصص (enableAlert=1) | `branch-custom-{id}` |
| `lease_installments` | `dueDate` | دفعة إيجار (7 أيام) | `installment-{id}` |

### الموظفون (Employees)

| الجدول | الحقل | الوصف | relatedField |
|--------|-------|-------|-------------|
| `employees` | `passportExpiry` | جواز السفر | `employee-passport-{id}` |
| `employees` | `emiratesIdExpiry` | الهوية الإماراتية | `employee-emiratesId-{id}` |
| `employees` | `workCardExpiry` | بطاقة العمل | `employee-workCard-{id}` |
| `employees` | `healthInsuranceExpiryDate` | التأمين الصحي | `employee-healthInsurance-{id}` |
| `employees` | `contractExpiryDate` | عقد العمل | `employee-contract-{id}` |
| `employees` | `loanExpiryDate` | الإعارة | `employee-loan-{id}` |
| `employees` | `unemploymentInsuranceExpiryDate` | تأمين التعطل | `employee-unemployment-{id}` |

### المركبات (Vehicles)

| الجدول | الحقل | الوصف | relatedField |
|--------|-------|-------|-------------|
| `vehicles` | `licenseExpiryDate` | رخصة المركبة | `vehicle-license-{id}` |
| `vehicles` | `insuranceExpiryDate` | تأمين المركبة | `vehicle-insurance-{id}` |
| `vehicle_custom_fields` | `alertDate` | حقل مخصص (enableAlert=1) | `vehicle-custom-{id}` |

### السكن (Housing)

| الجدول | الحقل | الوصف | relatedField |
|--------|-------|-------|-------------|
| `housing_units` | `contractExpiry` | عقد إيجار السكن | `housing-contract-{id}` |
| `housing_custom_fields` | `alertDate` | حقل مخصص (enableAlert=1) | `housing-custom-{id}` |

### أصحاب العمل (Employers)

| الجدول | الحقل | الوصف | relatedField |
|--------|-------|-------|-------------|
| `employers` | `passportExpiry` | جواز السفر | `employer-passport-{id}` |
| `employers` | `emiratesIdExpiry` | الهوية الإماراتية | `employer-emiratesId-{id}` |

### الكيانات الضريبية (Entities)

| الجدول | الحقل | الوصف | relatedField |
|--------|-------|-------|-------------|
| `entities` | `tradeLicenseExpiry` | الرخصة التجارية | `entity-tradeLicense-{id}` |

### الهواتف (Phones)

لا توجد حقول انتهاء.

---

## 3. خطة التنفيذ — ما تم وما تبقى

### ✅ المرحلة 1: ربط جميع الأقسام بنظام التنبيهات — **منتهي**

تم في `electron/ipc/notifications-ipc.ts`:
1. استعلامات الموظفين (7 حقول)
2. استعلامات المركبات (رخصة + تأمين + حقول مخصصة)
3. بطاقة المنشأة + GDRFA للأفرع
4. الحقول المخصصة للأفرع
5. عقد السكن + حقول مخصصة للسكن
6. أصحاب العمل (جواز + هوية)
7. الكيانات الضريبية (رخصة تجارية)

### ✅ المرحلة 2: إصلاح التناسق — **منتهي**

- توحيد `entityType` لدفعات الإيجار (`branch` بدل `lease`) في `ensureLeaseReminders`
- مسارات الانتقال في `NotificationCenter.getNavigatePath`: `housing`, `employer`, `entity`
- حذف التنبيهات عند أرشفة: الأفرع، أصحاب العمل، الكيانات (الموظف والمركبة كانا موجودين مسبقاً)
- احترام إعداد `NOTIFICATIONS_ENABLED` في `ensureAllExpiryReminders`

### ✅ ترجمة التنبيهات — **منتهي**

- مفاتيح في `notifications.*` (عربي/إنجليزي) للعناوين والرسائل وحالات الانتهاء
- تخزين مفاتيح (`docKey::statusKey`) في قاعدة البيانات وعرضها مترجمة في `NotificationCenter`

### ✅ المرحلة 3: صوت + إشعارات سطح المكتب — **منتهي**

- **صوت تنبيه:** تشغيل `/assets/notification.mp3` عند وصول تنبيهات جديدة (إن وُجد الملف)، مع احترام إعداد «صوت الإشعارات» في الإعدادات.
- **إشعارات نظام التشغيل:** إظهار إشعار Electron عند زيادة عدد غير المقروءة (وإعداد «إشعارات سطح المكتب» مفعّل)، مع النقر لفتح النافذة.
- **أيقونة الـ Tray:** إنشاء Tray مع قائمة (فتح / خروج). الأيقونة من `public/icons/tray-icon.png` إن وُجد (مثلاً 16×16 أو 32×32).
- **فحص دوري:** كل ساعة (`CHECK_INTERVAL_MS`) تشغيل `runCheckAndGetUnreadCount()` ثم مقارنة بعدد غير المقروءة السابق؛ عند الزيادة إرسال حدث `notification:newAlerts` للـ renderer (لصوت) وإظهار إشعار سطح المكتب إن كان مفعّلاً.
- **إعدادات:** مفتاحان جديدان في الإعدادات — صوت الإشعارات، إشعارات سطح المكتب — مع واجهة في `NotificationsSettings.tsx` وترجمة في `ar.json` / `en.json`.

---

## 4. منطق الـ severity

| الأيام المتبقية | المستوى | اللون |
|----------------|---------|-------|
| أقل من 0 (منتهي) | `danger` | أحمر |
| 0 — 30 يوم | `warning` | أصفر |
| 31 — 90 يوم | `info` | أخضر |

---

## 5. الملفات المتأثرة (تم تنفيذها)

| الملف | ما تم |
|-------|--------|
| `electron/ipc/notifications-ipc.ts` | كل الاستعلامات + مفاتيح ترجمة + NOTIFICATIONS_ENABLED |
| `src/components/Layout/NotificationCenter.tsx` | `getNavigatePath` (housing, employer, entity) + ترجمة العناوين/الرسائل |
| `src/components/Branches/BranchProfile.tsx` | حذف التنبيهات عند أرشفة الفرع |
| `src/components/Employers/EmployerProfile.tsx` | حذف التنبيهات عند أرشفة صاحب العمل |
| `src/components/Entities/EntityProfile.tsx` | حذف التنبيهات عند أرشفة الكيان |
| `src/locales/ar.json` + `en.json` | مفاتيح `notifications.status`, `notifications.docs`, `notifications.messages` |
| `docs/NOTIFICATIONS_AND_ALERTS.md` | تحديث التوثيق |
