# نظام المستندات (DMS) — شرح كامل ودقيق

هذا المستند يشرح **نظام إدارة المستندات** في التطبيق بالكامل: التخزين، الجدول، الربط بالكيانات، قسم المستندات (مستكشف الملفات)، المستندات داخل الأقسام الأخرى (البروفايلات)، الأرشفة التلقائية عند استبدال المستند، ومستكشف المستندات المؤرشفة.

---

## 1. نظرة عامة

- **التخزين الفعلي:** الملفات تُنسخ إلى مجلد ثابت داخل بيانات التطبيق: `app.getPath('userData')/documents/`. كل سجل مستند يُخزَّن في قاعدة البيانات مع **مسار نسبي** من جذر هذا المجلد.
- **جدول `documents`:** يربط كل ملف بـ `entityType` و `entityId` و `section` لتمييزه وعرضه في القسم المناسب.
- **التخزين الآمن والدفق (Streaming):** يتم عرض المستندات وخصوصاً الملفات الكبيرة (PDF) من خلال بروتوكول محلي مخصص `local-file://` بدلاً من تحويلها إلى Base64، مما يمنع حصول أي مشاكل باختناق الذاكرة.
- **قسم "المستندات":** صفحة مستقلة (`/dashboard/documents`) تعرض **مستكشفاً هرمياً** (مجلدات وملفات) حسب نوع الكيان (أفرع، موظفون، سكن، مركبات، ضرائب) باستخدام منطق يعتمد على النمط الاستراتيجي لمعالجة الأنواع المختلفة بمرونة (Strategy Pattern).
- **المستندات في البروفايلات:** كل بروفايل يحتوي تبويب "المستندات" يعرض الملفات المرتبطة بهذا العنصر فقط، مع معاينة وحذف وفتح خارجي.
- **العمليات الذرية (Atomic Saves):** تُدار عمليات حفظ الملفات ونسخها وأرشفتها داخل معاملات قاعدة بيانات (Database Transactions) لضمان عدم حدوث تضارب في البيانات، وعدم ترك ملفات يتيمة (Orphaned Files) على القرص.
- **الأرشفة:** عند رفع مستند جديد **نفس القسم ونفس الكيان**، المستند القديم يُنقل تلقائياً إلى مجلد `Archive/` ويُحدَّث سجله في الجدول إلى `isArchived = 1`. مستكشف "المستندات المؤرشفة" في صفحة الأرشيف يعرض فقط السجلات المؤرشفة.

---

## 2. جدول قاعدة البيانات: `documents`

| العمود | النوع | الوصف |
|--------|--------|--------|
| id | INTEGER PK | المعرف |
| relativePath | TEXT | المسار النسبي من جذر مجلد المستندات (مثل Branches/5/license_expiry/file.pdf) |
| customName | TEXT | الاسم المعروض للملف (قد يختلف عن اسم الملف على القرص) |
| entityType | TEXT | نوع الكيان: branch, employee, vehicle, housing, entity, phone, company |
| entityId | INTEGER | معرف السجل (فرع، موظف، مركبة، وحدة سكن، كيان ضريبي) — قد يكون NULL لبعض الأنواع |
| section | TEXT | القسم أو التصنيف (مثل license_expiry, passport, vat_cert) — يحدد مكان العرض |
| isArchived | INTEGER | 0 = نشط، 1 = مؤرشف (تم استبداله بمستند جديد) |
| createdAt | TEXT | وقت الإدراج |

- **الفهرس الضمني:** الاستعلامات تعتمد على entityType و entityId و section و isArchived.

---

## 3. جذر التخزين وبنية المسارات

- **الجذر:** `path.join(app.getPath('userData'), 'documents')` — يُنشأ تلقائياً إن لم يكن موجوداً.
- **المسار الكامل لملف:** `جذر المستندات + relativePath`.

أمثلة على **relativePath** حسب المصدر:

| الكيان | مثال المسار | section نموذجي |
|--------|-------------|----------------|
| فرع | Branches/123/license_expiry/رخصة.pdf | license_expiry, trade_license, lease, establishment |
| موظف | Employees/45/passport/جواز.pdf | passport, residency, mohre_contract, photo, health_insurance, unemployment_insurance, expiry_updates |
| مركبة | Vehicles/7/license/رخصة.pdf | license, insurance |
| سكن | Housing/وحدة أ/lease_expiry/عقد.pdf | lease_expiry أو مسار فرعي |
| كيان ضريبي | Taxes/2/vat_cert/شهادة.pdf | vat_cert, corporate_tax_cert؛ أو Taxes/2/payments/... |
| إنهاء موظف | Employees/45/termination/إنهاء.pdf | termination |

**ملاحظة (هامة):** بالنسبة للموظفين، **يُعتمد معرف الموظف (ID) حصراً في بنية المجلدات** بدلاً من الاسم المكتوب (يعني `Employees/45/...` بدلاً من `Employees/أحمد/...`) وذلك لضمان سلامة الهيكل وعدم تشتت الملفات في حالة قام المستخدم بتغيير اسم الموظف. مستكشف الملفات مُبرمج ليترجم هذه الأرقام إلى أسماء الموظفين تلقائياً عند عرضها للمستخدم في لوحة التحكم للحصول على تجربة استخدام بديهية.

---

## 4. واجهات Electron (IPC)

**التعريف:** `src/types/electron.d.ts`  
**التنفيذ:** `electron/main.ts`

| الواجهة | الوظيفة |
|---------|----------|
| documentSave(args) | نسخ الملف من مصدره إلى جذر المستندات مع عمليات ذرية (Transactions). يضمن أرشفة المستند السابق لنفس (entityType, entityId, section) ثم إدراج المستند الجديد أو التراجع بالكامل عند الخطأ، منعاً لوجود ملفات غير مسجلة (orphaned). |
| documentList(entityType?, id?, sec?)| إرجاع قائمة المستندات النشطة (isArchived = 0) مع فلترة ديناميكية. |
| documentGetUrl(relativePath) | يُرجع مسار من نوع `local-file://{encodedPath}` للمعاينة والدفق المباشر دون استنزاف للذاكرة. |
| documentOpenExternal(relativePath)| فتح الملف بالتطبيق الافتراضي المدمج في نظام تشغيل المستخدم. |
| documentDelete(id) | حذف السجل ضمن المعاملات وحذف الملف من القرص ليحفظ المساحة. |
| documentListExplorer(folderPath) | قائمة مجلدات وملفات للمستكشف (النشطة فقط). منظم باستخدام كائنات مسار مستقلة (Strategy Map). |
| documentListArchiveExplorer(path) | مستكشف خاص بالسجلات المؤرشفة التي تُحفظ في `Archive/` ومُدار باستخدام `archiveExplorerHandlers`. |
| documentCreateFolder(folderName, parentPath?) | إنشاء مجلد فعلي تحت الجذر (للمسارات المخصصة فقط) |
| documentDeleteFolder(folderPath) | حذف مجلد وحذف كل السجلات التي relativePath يبدأ بـ folderPath — ممنوع لحذف الجذور الثابتة (Branches, Employees, ...) |
| fileSelectDocument() | فتح نافذة اختيار ملف من النظام (openFile) |

---

## 5. آلية documentSave والأرشفة التلقائية (مُعاملات مسجلة Atomic Transactions)

1. **بدء المُعاملة (Transaction Start):** جميع الخطوات أدناه تحدث ضمن مُعاملة قاعدة بيانات واحدة مجمعة باستخدام TypeORM. إذا فشل أي جزء، تتراجع العملية بالكامل.
2. التحقق من وجود الملف المصدري على القرص.
3. التفتيش عن سجل نشط (isArchived = 0) عبر `entityType` و `entityId` و `section`.
4. إن وُجد:
   - يُنقل الملف المادي وتُعاد تسميته للإصدار المؤرشف. 
   - يُحدَّث السجل القديم ليصبح `isArchived = 1` ويُغير مساره في الـ DB.
5. نسخ الملف المصدري إلى موقعه الجديد.
6. إدراج السجل الجديد بنجاح أو **التراجع (Rollback)** وإلغاء التغييرات الفعلية (حذف ما نُسخ واستعادة ما نُقل) إذا طرأ أي خطأ برمجي أو تنفيذي في قاعدة البيانات.

---

## 6. قسم المستندات (صفحة /dashboard/documents)

**المسار:** `src/pages/Documents.tsx`

### الوظيفة

- **مستكشف هرمي:** شريط تنقل (breadcrumb) من الجذر إلى المسار الحالي، مع عرض المجلدات والملفات في المسار الحالي.
- **الجذور الثابتة:** Branches، Employees، Housing، Phones، Vehicles، Taxes — كل واحد أيقونة خاصة (من ROOT_FOLDER_ICONS). يمكن أيضاً ظهور **مجلدات مخصصة** إذا وُجدت مجلدات فعلية تحت الجذر بأسماء غير هذه القائمة (قابلة للحذف).
- **التنقل:** النقر على مجلد يضيفه إلى المسار ويُحدَّث المحتوى عبر `documentListExplorer(folderPath)`.

### منطق documentListExplorer (النشط) و archiveExplorerHandlers في Electron

بسبب تفرع المنطق وازدياد تعقيد المستكشف تم إعادة توجيه هذا الجزء لاستخدام هيكليات خرائط الإستراتيجيات المُعدة سلفاً `explorerHandlers` للمستكشف الأساسي و `archiveExplorerHandlers` للمستكشف المؤرشف.
كل مسار (الجذر) يتم تغذيته بهذه الدوال، مثلاً:

- **الجذر:** إن كان `folderPath` فارغ، تُعاد الجذور الستة بشكل تلقائي مع دمجها بالمجلدات اليدوية.
- **Branches:** مستوى 1 و 2 و 3 تديره دالة الـ `Branches` Handler لترجمة الـ Id لمسميات واسترجاع أقسام.
- **Employees:** تديره دالة الموظفين مع تحويل المجلد المُسجل برقم الهوية إلى أسماء الموظفين كما يُستمد من جداول `employees` وعرض مقاطعهم الافتراضية.
- **بقية الكيانات:** كلٌ له دالة خاصة ضمن ה`Handlers` تقوم بالمعالجة وعرض الملفات حسب طبقات المتصفح.

### الإجراءات في الصفحة

- **إنشاء مجلد:** زر "إضافة مجلد" — يفتح نافذة لإدخال الاسم؛ الاستدعاء `documentCreateFolder(name, currentPath)`. يُسمح به في أي مسار (يُنشئ مجلداً فعلياً فقط؛ لا سجل في الجدول للمجلد نفسه).
- **رفع مستند:** يظهر زر "تحميل مستند" عندما يكون المسار داخل فرع (Branches/id/section) أو سكن أو ضرائب (Taxes/id/section). يفتح اختيار ملف ثم نافذة لاسم مخصص؛ يتم حساب entityType و entityId و section من المسار الحالي ويُستدعى `documentSave`.
- **معاينة ملف:** documentGetUrl ثم عرض في modal (صورة أو iframe).
- **فتح/تحميل:** documentOpenExternal.
- **حذف ملف:** documentDelete(id) ثم إعادة تحميل القائمة.
- **حذف مجلد:** documentDeleteFolder(folderPath) — فقط للمجلدات المخصصة (غير الثابتة).

---

## 7. المستندات داخل بروفايلات الأقسام

### الفرع (BranchProfile)

- **documentList('branch', branchId)** — يجلب كل المستندات النشطة للفرع.
- **الأقسام المعروضة:** حسب section (trade_license, lease, establishment، وأقسام مخصصة من branch_custom_fields).
- في تبويب "المستندات" تُعرض القائمة مع أزرار معاينة، فتح خارجي، حذف.
- ربط الرخصة وعقد الإيجار: أزرار "تحديث انتهاء" تربط بـ documentConfig (section: license_expiry, lease_expiry)؛ عند الحفظ من UpdateExpiryPopup يُحفظ المستند المرفق في المسار Branches/{branchId}/{section}/...

### الموظف (EmployeeProfile)

- **documentList('employee', employeeId)** — كل المستندات النشطة للموظف.
- **الأقسام:** passport_expiry, contract_expiry, emirates_id_expiry, health_insurance_expiry, unemployment_insurance_expiry, loan_expiry، وثائق من نموذج الإضافة (passport, residency, mohre_contract, photo, ...)، و termination لإنهاء التعاقد.
- نفس النمط: عرض قائمة، معاينة، فتح، حذف. تحديث انتهاء من البروفايل يمرّر documentConfig إلى UpdateExpiryPopup الذي يبني المسار Employees/{entityId}/{section}/...

### المركبة (VehicleProfile)

- **documentList('vehicle', vehicleId)** — المستندات النشطة للمركبة.
- **الأقسام:** license, insurance (وأي أقسام إضافية حسب الاستخدام). تحديث انتهاء الرخصة/التأمين مع إرفاق مستند عبر UpdateExpiryPopup → Vehicles/{vehicleId}/license أو insurance.

### السكن (HousingProfile)

- المستندات مرتبطة بالوحدة؛ المسار من AddHousingModal و UpdateHousingExpiryModal (مثل Housing/{housingId}/lease_expiry/...).

### الكيان الضريبي (EntityProfile)

- **documentList('entity', entityId)** — المستندات للكيان؛ الفلتر في الواجهة لـ section = vat_cert أو corporate_tax_cert.
- رفع الشهادات من AddEntityModal أو من تبويب المستندات في البروفايل. مدفوعات الضريبة (VAT/شركات) يمكن ربط مرفق بها — المسار Taxes/{entityId}/payments/...

---

## 8. ربط المستند عند "تحديث انتهاء" (UpdateExpiryPopup)

- **DocumentLinkConfig:** entityType, entityId, section.
- عند اختيار ملف وحفظ:
  - بناء المسار: `{EntityFolder}/{entityId}/{section}/{fileName}` حيث EntityFolder = Branches | Employees | Vehicles (أو Housing/Entity حسب الاستخدام).
  - استدعاء documentSave مع sourceFilePath و relativePath و customName و entityType و entityId و section.
- النتيجة: المستند الجديد يُحفظ ويُربط بالكيان والقسم؛ إن كان هناك مستند سابق لنفس الثلاثة يُؤرشف تلقائياً.

---

## 9. مستكشف المستندات المؤرشفة (صفحة الأرشيف)

**المسار:** `src/pages/Archive.tsx` — تبويب "مستكشف المستندات المؤرشفة".

- **الاستدعاء:** `documentListArchiveExplorer(folderPath)` — نفس البنية الهرمية مثل documentListExplorer لكن الاستعلامات تضيف شرط `isArchived = 1`.
- **الجذور:** نفس الستة (Branches, Employees, Housing, Phones, Vehicles, Taxes). تحت كل جذر تُعرض المجلدات حسب السجلات المؤرشفة فقط (مثلاً قائمة entityId للأفرع/الموظفين/المركبات/الضرائب التي لديها مستندات مؤرشفة).
- **المجلدات والملفات:** تعتمد على السجلات المؤرشفة فقط؛ مثلاً تحت Branches تظهر الفروع التي لديها مستندات مؤرشفة، ثم الأقسام، ثم قائمة الملفات المؤرشفة.
- **الإجراءات:** معاينة وفتح خارجي (نفس documentGetUrl و documentOpenExternal) — لا استعادة ولا حذف في الوصف الحالي؛ المستندات المؤرشفة للعرض والمراجعة.

---

## 10. أقسام (sections) حسب نوع الكيان

| entityType | أقسام شائعة (section) |
|------------|------------------------|
| branch | trade_license, lease, establishment, license_expiry, lease_expiry, establishment_immigration_expiry + أقسام مخصصة (عنوان من branch_custom_fields) |
| employee | passport, residency, mohre_contract, photo, health_insurance, unemployment_insurance, passport_expiry, contract_expiry, emirates_id_expiry, health_insurance_expiry, unemployment_insurance_expiry, loan_expiry, termination |
| vehicle | license, insurance + permits, other |
| housing | lease_expiry وأي مسارات فرعية |
| entity | vat_cert, corporate_tax_cert، وضمن payments (ربط بمدفوعات الضريبة) |
| phone | — (بدون section أو section عام) |
| company | مسارات مخصصة من صفحة المستندات |

---

## 11. رفع المستند من النماذج (إضافة/تعديل)

- **AddEmployeeModal:** أقسام جواز، إقامة، عقد MOHRE، صورة، تأمين صحي، تأمين تعطل؛ المسار Employees/{اسم الموظف}/{section}/...
- **AddBranchModal:** رخصة تجارية (trade_license)، عقد إيجار (lease)، وأقسام مخصصة (sectionKey = section.id)؛ المسار Branches/{branchId}/{sectionKey}/...
- **AddVehicleModal:** مستندات أقسام مخصصة + license/insurance عند الحاجة؛ المسار Vehicles/{vehicleId}/{section}/...
- **AddEntityModal:** شهادة VAT (vat_cert)، شهادة ضريبة شركات (corporate_tax_cert) — المسار ضمن Taxes أو entity.
- **AddHousingModal:** مستندات للوحدة؛ المسار Housing/...
- **UpdateStatusModal (إنهاء تعاقد):** مستند إنهاء → Employees/{name}/termination/...
- **UpdateLeaseExpiryModal، UpdateHousingExpiryModal:** إرفاق مستند مع تحديث الانتهاء — نفس آلية documentSave مع section المناسب.

---

## 12. حذف المستند وحذف المجلد

- **documentDelete(id):** حذف السجل من الجدول وحذف الملف من القرص (باستخدام relativePath المحفوظ).
- **documentDeleteFolder(folderPath):** مسموح فقط للمسارات التي **لا** تبدأ بأحد الجذور الثابتة (Branches, Employees, Housing, Phones, Vehicles, Taxes). يحذف كل السجلات التي relativePath = folderPath أو يبدأ بـ folderPath/ ثم يحذف المجلد والملفات تحته من القرص (rmRecursive).

---

## 13. ملخص الربط بين قسم المستندات والأقسام الأخرى

| المصدر | العرض في |
|--------|----------|
| رفع من صفحة المستندات (مستكشف) | نفس الصفحة + تبويب المستندات في البروفايل المناسب (عند التصفية بـ entityType و entityId) |
| رفع من بروفايل فرع/موظف/مركبة/سكن/كيان | تبويب المستندات في ذلك البروفايل + يظهر في مستكشف المستندات تحت المسار الموافق |
| رفع من "تحديث انتهاء" | تبويب المستندات + نفس القسم في المستكشف |
| أرشفة تلقائية عند استبدال مستند | المستند القديم يظهر فقط في مستكشف المستندات المؤرشفة (تبويب الأرشيف) |

---

## 14. ملخص للمطور

| العنصر | الموقع |
|--------|--------|
| جدول المستندات | documents (relativePath, customName, entityType, entityId, section, isArchived) |
| جذر الملفات | app.getPath('userData')/documents |
| صفحة المستندات | src/pages/Documents.tsx — documentListExplorer |
| مستكشف المؤرشفة | Archive.tsx — documentListArchiveExplorer |
| حفظ مع أرشفة | electron document:save |
| قائمة حسب كيان | documentList(entityType, entityId, section) |
| ربط "تحديث انتهاء" | UpdateExpiryPopup + DocumentLinkConfig → documentSave |
| إنشاء/حذف مجلد | documentCreateFolder, documentDeleteFolder (المجلدات المخصصة فقط للحذف) |
