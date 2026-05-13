# نبذة احترافية عن برنامج RMDATA للمبرمجين وأدوات الذكاء الاصطناعي

## 1. تعريف البرنامج

برنامج **RMDATA** هو نظام إدارة داخلي لشركة **الرداء الموحد**. الهدف منه تنظيم بيانات الشركة التشغيلية والإدارية في مكان واحد، بدل الاعتماد على ملفات Excel ومجلدات ومستندات متفرقة.

النظام يخدم الإدارة والموظفين والفروع، ويغطي بيانات:

- الفروع والمنشآت.
- الكيانات القانونية والضريبية.
- الموظفين.
- أصحاب العمل/الملاك/الشركاء.
- السكن العمالي.
- المركبات.
- الهواتف.
- المستندات.
- التنبيهات والانتهاءات.
- المستخدمين والصلاحيات.
- السجلات والأرشيف.

البرنامج بدأ كتطبيق سطح مكتب محلي يعمل عبر **Electron + React + SQLite**، ثم تطور ليعمل أيضاً مع قاعدة بيانات مركزية على السيرفر عبر **MySQL/MariaDB** وواجهات API على VPS.

## 2. الهدف العملي من النظام

البرنامج ليس موقعاً تسويقياً ولا تطبيقاً عاماً، بل نظام تشغيلي داخلي. الهدف الأساسي:

1. حفظ بيانات الشركة بشكل منظم.
2. متابعة تواريخ الانتهاء المهمة مثل الإقامات، الجوازات، عقود الإيجار، الرخص، التأمينات.
3. ربط الموظف بالفرع والكيان القانوني وصاحب العمل.
4. إدارة المستندات والصور والملفات الخاصة بكل سجل.
5. ضبط من يرى ماذا عبر نظام صلاحيات.
6. توفير نسخة سطح مكتب للموظفين والإدارة.
7. تجهيز الأساس لنسخة ويب/موبايل في v2.

## 3. التقنيات المستخدمة

### الواجهة

- React 18.
- TypeScript.
- Vite.
- Tailwind CSS.
- React Router.
- Zustand لإدارة حالة المستخدم والجلسة.
- i18next للترجمة العربية والإنجليزية.
- Lucide React للأيقونات.

### تطبيق سطح المكتب

- Electron.
- Electron preload مع `contextBridge`.
- IPC handlers للتعامل مع قاعدة البيانات والملفات والنسخ الاحتياطي والتحديثات.
- Electron auto updater لتحديث البرنامج من السيرفر.

### قاعدة البيانات

يوجد مساران:

- SQLite محلي داخل جهاز المستخدم.
- MySQL/MariaDB على السيرفر/VPS.

في الوضع المحلي، البرنامج يستخدم SQLite داخل مجلد بيانات التطبيق.  
في الوضع البعيد، البرنامج يتصل بواجهة API تقرأ وتكتب في MySQL/MariaDB.

### الخادم وواجهات API

يوجد مساران API:

- Node.js/Express في مجلد `server`.
- PHP gateway في مجلد `api-gateway-php`.

الهدف المستقبلي الأفضل هو توحيد الاعتماد على Node API فوق VPS، وترك PHP كمسار قديم أو احتياطي إذا لزم.

### ملفات ومرفقات

النظام يدير:

- صور الموظفين.
- صور الفروع.
- صور أصحاب العمل.
- مستندات PDF وصور ووثائق.
- أرشفة المستند القديم عند رفع مستند جديد.

المرفقات تكون محلية في تطبيق Electron أو على storage في السيرفر حسب وضع التشغيل.

## 4. طريقة عمل البرنامج بشكل عام

### عند تشغيل تطبيق سطح المكتب

1. Electron يفتح التطبيق.
2. يتم تحديد مسار قاعدة البيانات المحلية.
3. يتم تشغيل migrations للتأكد من وجود الجداول والأعمدة.
4. يتم فتح واجهة React.
5. المستخدم يسجل الدخول.
6. الواجهة تستدعي `window.electronAPI` لتنفيذ العمليات.
7. إذا كان الوضع Local، يتم استخدام SQLite.
8. إذا كان الوضع Remote، يتم إرسال الطلبات إلى API على السيرفر.

### عند فتح الواجهة من المتصفح

عند عدم وجود Electron، يستخدم النظام polyfill في:

`src/api/browserApiPolyfill.ts`

هذا الملف يوفر بديلاً عن `window.electronAPI` ويرسل الطلبات إلى `/api`.

## 5. أقسام البرنامج الرئيسية

### 5.1 لوحة التحكم

المسار البرمجي:

- `src/pages/Dashboard.tsx`
- `src/components/Dashboard/DashboardHome.tsx`

الوظيفة:

- عرض ملخص عام للنظام.
- إظهار أعداد الفروع والموظفين والتنبيهات.
- توفير نقطة دخول سريعة للأقسام المهمة.

### 5.2 الفروع

المسارات:

- `src/components/Branches/Branches.tsx`
- `src/components/Branches/AddBranchModal.tsx`
- `src/components/Branches/BranchProfile.tsx`
- `src/components/Branches/ViewBranchModal.tsx`

الوظيفة:

- إضافة وتعديل الفروع.
- تخزين بيانات الموقع، الإمارة، المدينة، النوع، الترخيص، عقد الإيجار، المرفقات.
- ربط الفرع بالكيانات القانونية وأصحاب العمل والموظفين.
- متابعة انتهاء الرخص وعقود الإيجار.
- حفظ سجل نشاط للعمليات المهمة.

الفروع من أهم أقسام النظام لأنها تربط بين الإدارة والموظفين والكيانات القانونية والسكن والمركبات.

### 5.3 الموظفون

المسارات:

- `src/components/Employees/Employees.tsx`
- `src/components/Employees/AddEmployeeModal.tsx`
- `src/components/Employees/EmployeeProfile.tsx`
- `src/components/Employees/UpdateStatusModal.tsx`
- `src/components/Employees/profile/*`

الوظيفة:

- إضافة وتعديل الموظفين.
- حفظ بيانات شخصية ووظيفية.
- ربط الموظف بفرع عمل وكيان قانوني.
- متابعة الجواز، الهوية، الإقامة، العقد، التأمين، الراتب، الحالة الوظيفية.
- إدارة الحالات مثل يعمل، إجازة، معار، موقوف، منتهي، مؤرشف.
- رفع مستندات الموظف.
- تتبع سجل تغييرات الحالة.

هذا القسم حساس جداً لأن فيه رواتب ومستندات وبيانات شخصية، لذلك يجب أن يكون محمياً بالصلاحيات.

### 5.4 أصحاب العمل / الملاك / الشركاء

المسارات:

- `src/components/Employers/Employers.tsx`
- `src/components/Employers/AddEmployerModal.tsx`
- `src/components/Employers/EmployerProfile.tsx`
- `src/components/Employers/LinkBranchModal.tsx`

الوظيفة:

- إدارة بيانات أصحاب العمل.
- ربط صاحب العمل بفرع أو أكثر.
- تحديد الدور أو نسبة الملكية.
- حفظ الصور والمستندات.
- تتبع علاقته بالفروع والمنشآت.

### 5.5 الكيانات القانونية والضريبية

المسارات:

- `src/components/Entities/Entities.tsx`
- `src/components/Entities/AddEntityModal.tsx`
- `src/components/Entities/EntityProfile.tsx`
- `src/components/Entities/entityProfile/*`

الوظيفة:

- إدارة الكيانات القانونية.
- حفظ بيانات الرخص والضرائب والعناوين.
- ربط الكيانات بالفروع.
- متابعة المستندات الخاصة بالكيان.

هذا القسم مهم للربط القانوني والضريبي بين الفروع والموظفين.

### 5.6 السكن

المسارات:

- `src/components/Housing/Housing.tsx`
- `src/components/Housing/AddHousingModal.tsx`
- `src/components/Housing/HousingProfile.tsx`
- `src/components/Housing/AssignOccupantModal.tsx`

الوظيفة:

- إدارة وحدات السكن.
- ربط السكن بفرع أو صاحب عمل.
- تسجيل الساكنين.
- إدارة عقود الإيجار والدفعات.
- متابعة انتهاء عقد السكن.
- حفظ المستندات.

### 5.7 المركبات

المسارات:

- `src/components/Vehicles/Vehicles.tsx`
- `src/components/Vehicles/AddVehicleModal.tsx`
- `src/components/Vehicles/VehicleProfile.tsx`
- `src/components/Vehicles/AssignResponsibleModal.tsx`

الوظيفة:

- إدارة سيارات ومركبات الشركة.
- حفظ بيانات الملكية والتأمين والتسجيل.
- ربط المركبة بفرع أو موظف مسؤول.
- متابعة تواريخ الانتهاء.
- حفظ المستندات.

### 5.8 الهواتف

المسارات:

- `src/components/Phones/Phones.tsx`
- `src/components/Phones/AddPhoneModal.tsx`
- `src/components/Phones/PhoneProfile.tsx`

الوظيفة:

- إدارة أرقام الهواتف والأجهزة.
- ربط الهاتف بموظف أو صاحب عمل أو فرع.
- حفظ نوع الخط وحالته.
- متابعة المستندات إن وجدت.

### 5.9 المستندات

المسارات:

- `src/pages/Documents.tsx`
- `src/components/shared/DocumentPreviewModal.tsx`
- `src/components/shared/DocumentNameModal.tsx`
- `electron/ipc/document-ipc.ts`
- `api-gateway-php/api/index.php`
- `server/dev-api-server.js`

الوظيفة:

- رفع المستندات.
- ربط المستند بنوع سجل معين مثل employee أو branch أو vehicle.
- معاينة ملفات PDF والصور والنصوص.
- أرشفة المستند القديم عند رفع بديل.
- حذف المستندات حسب الصلاحيات.

### 5.10 التنبيهات

المسارات:

- `src/components/Layout/NotificationCenter.tsx`
- `electron/ipc/notifications-ipc.ts`
- `electron/notification-background.ts`

الوظيفة:

- إنشاء تنبيهات للانتهاءات.
- عرض التنبيهات غير المقروءة.
- دعم إشعارات سطح المكتب.
- أرشفة أو حذف التنبيهات.
- تشغيل فحص دوري للتنبيهات.

### 5.11 الأرشيف

المسارات:

- `src/pages/Archive.tsx`
- `src/components/Archive/ArchivedEntityCard.tsx`

الوظيفة:

- عرض السجلات المؤرشفة.
- دعم استعادة أو مراجعة السجلات القديمة.
- يستخدم مع الموظفين والفروع وغيرها حسب الحالة.

### 5.12 السجلات والتاريخ

المسارات:

- `src/pages/Logs.tsx`
- `src/services/logsService.ts`
- `src/components/shared/HistoryTab.tsx`
- `src/utils/activityLog.ts`

الوظيفة:

- تسجيل نشاط المستخدمين.
- تتبع تغييرات مهمة.
- عرض تاريخ السجل داخل صفحات التفاصيل.

### 5.13 الإعدادات

المسارات:

- `src/components/Settings/Settings.tsx`
- `src/components/Settings/sections/*`

الأقسام:

- عام.
- اللغة.
- قاعدة البيانات.
- المستخدمون.
- الأدوار.
- صلاحيات المستخدمين.
- التنبيهات.
- النسخ الاحتياطي.
- الأجهزة المتصلة.
- حول النظام.

الإعدادات من أهم أجزاء v2 لأنها تتحكم في طريقة اتصال النظام، المستخدمين، الصلاحيات، والتحديثات.

## 6. نظام المستخدمين والصلاحيات

النظام يحتوي على:

- مستخدمين.
- أدوار.
- صلاحيات.
- صلاحيات حسب الدور.
- سماح أو منع مخصص للمستخدم.
- ربط المستخدم بموظف أو صاحب عمل.

الملفات المهمة:

- `src/permissions/permissionCatalogV2.ts`
- `src/services/permissionsService.ts`
- `src/hooks/usePermissions.ts`
- `server/permissions-resolver.js`
- `server/permission-middleware.js`
- `electron/database/permission-catalog-sync.ts`

الفكرة:

- الواجهة تستخدم `can(module, action)` لإخفاء أو إظهار الأزرار والتبويبات والحقول.
- السيرفر يجب أن يتحقق من الصلاحيات أيضاً، وليس الواجهة فقط.
- Admin يملك كل الصلاحيات.
- بقية المستخدمين يحصلون على صلاحيات حسب الدور والتخصيص.

ملاحظة للمطور:

في v2 يجب تقوية الصلاحيات على مستوى backend خصوصاً للرواتب، المستندات، العقود، المستخدمين، وتغيير الصلاحيات.

## 7. قاعدة البيانات

### الجداول الأساسية

أهم الجداول المتوقعة:

- `users`
- `roles`
- `permissions`
- `role_permissions`
- `user_permissions`
- `user_permission_overrides`
- `entities`
- `branches`
- `employees`
- `employers`
- `branch_employers`
- `vehicles`
- `phones`
- `housing_units`
- `housing_occupants`
- `housing_installments`
- `documents`
- `notifications`
- `activity_logs`
- `status_history`
- `connected_devices`
- `settings`

### ملفات قاعدة البيانات

- SQLite entities:
  - `src/database/entities/*`

- SQLite data source:
  - `src/database/data-source.ts`

- Electron migrations:
  - `electron/database/migrations.ts`
  - `src/database/migrations/*`

- MySQL schema:
  - `database/mysql-schema-rmdata.sql`

- MySQL migrations:
  - `database/mysql-migrate-*.sql`

## 8. طريقة الاتصال بالبيانات

### Local Mode

في الوضع المحلي:

React → `window.electronAPI.dbQuery` → Electron IPC → SQLite

هذا الوضع مناسب لتشغيل نسخة مستقلة على جهاز واحد.

### Remote Mode

في الوضع البعيد:

React/Electron → Electron IPC → API على السيرفر → MySQL/MariaDB

أو:

Browser React → `browserApiPolyfill` → API → MySQL/MariaDB

هذا الوضع مناسب للعمل المشترك بين أكثر من جهاز وفرع.

## 9. الخادم وVPS

المشروع يحتوي سكربتات لتشغيل Node API على VPS:

- `scripts/vps-setup-node-pm2.sh`
- `scripts/vps-node-api-ecosystem.config.cjs`
- `scripts/vps-nginx-node-bridge.conf`
- `scripts/vps-backup-daily.sh`
- `scripts/vps-verify-phase05.sh`

البرنامج يستخدم أيضاً مسار تحديثات:

`https://api.rmdata.tech/updates/win`

ويتم نشر ملفات التحديث داخل `release/` مثل:

- `latest.yml`
- installer `.exe`
- `.blockmap`

## 10. مشروع الموبايل

يوجد مجلد:

`mobile`

وهو مشروع Expo/React Native أولي. حالياً ليس هو التطبيق الأساسي، لكنه مناسب كبداية مستقبلية لأن:

- المشروع الرئيسي React/TypeScript.
- يمكن مشاركة بعض الأنواع والثوابت.
- يمكن استخدام نفس API عند استقراره.

التوصية:

لا تبدأ الموبايل الكامل قبل توحيد API على السيرفر. الموبايل يجب أن يعتمد على endpoints واضحة، وليس SQL مباشر.

## 11. أهم الملفات التي يجب أن يعرفها أي مبرمج

### تشغيل وبناء

- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `electron/tsconfig.json`

### مدخل الواجهة

- `src/main.tsx`
- `src/App.tsx`
- `src/pages/Dashboard.tsx`

### Electron

- `electron/main.ts`
- `electron/preload.ts`
- `electron/ipc/*`
- `electron/remote-api-utils.ts`
- `electron/local-settings-store.ts`

### قاعدة البيانات

- `src/database/data-source.ts`
- `src/database/entities/*`
- `electron/database/migrations.ts`
- `database/mysql-schema-rmdata.sql`

### API

- `server/dev-api-server.js`
- `server/mysql-db.js`
- `server/permissions-resolver.js`
- `server/permission-middleware.js`
- `api-gateway-php/api/index.php`
- `api-gateway-php/src/*`

### الصلاحيات

- `src/permissions/permissionCatalogV2.ts`
- `src/services/permissionsService.ts`
- `src/hooks/usePermissions.ts`
- `server/permissions-catalog.js`

### الخدمات في الواجهة

- `src/services/*`
- `src/hooks/*`
- `src/utils/*`

## 12. كيف يبدأ مبرمج جديد

على المبرمج الجديد أن يبدأ بهذا الترتيب:

1. قراءة `package.json` لمعرفة السكربتات والتقنيات.
2. تشغيل:
   - `npm install`
   - `npm run dev`
3. فهم الفرق بين Local وRemote mode.
4. قراءة `src/App.tsx` و`src/pages/Dashboard.tsx`.
5. قراءة `electron/preload.ts` لمعرفة ما هو متاح للواجهة.
6. قراءة `electron/ipc/settings-ipc.ts` و`electron/ipc/auth-ipc.ts`.
7. قراءة `server/dev-api-server.js` لفهم API الحالي.
8. قراءة `src/permissions/permissionCatalogV2.ts` لفهم الصلاحيات.
9. قراءة أحد الأقسام كنموذج، مثلاً:
   - `Employees.tsx`
   - `AddEmployeeModal.tsx`
   - `EmployeeProfile.tsx`

## 13. كيف تعطي المشروع لأداة ذكاء اصطناعي

إذا أردت من أداة ذكاء اصطناعي تطوير المشروع، أعطها هذا السياق:

> هذا مشروع RMDATA، نظام ERP داخلي لشركة الرداء الموحد. مبني بـ React + TypeScript + Electron + SQLite، وتطور ليعمل مع MySQL/MariaDB عبر API على VPS. يحتوي أقسام الفروع، الموظفين، الكيانات، أصحاب العمل، السكن، المركبات، الهواتف، المستندات، التنبيهات، الإعدادات، المستخدمين، والصلاحيات. المشروع يعمل حالياً، لكن يحتاج تنظيف قبل v2. المطلوب عدم إعادة كتابة المشروع من الصفر، بل تحسينه تدريجياً مع الحفاظ على عمل النسخة الحالية.

ثم أعطها قواعد العمل:

- لا تكسر وضع Local SQLite.
- لا تكسر وضع Remote API.
- لا تغير schema بدون migration.
- لا تعتمد على الواجهة فقط في الصلاحيات.
- لا تضف ميزة كبيرة قبل إصلاح أخطاء TypeScript.
- لا تعدل ملفات `dist`, `dist-electron`, `release`.
- ركز على ملفات `src`, `electron`, `server`, `api-gateway-php`, `database`, `scripts`.

## 14. ملاحظات مهمة قبل تطوير v2

1. المشروع يعمل، لذلك الأولوية ليست إعادة الكتابة.
2. أكبر خطر حالي هو تعدد مسارات البيانات.
3. يجب تقليل الاعتماد على `db:query` العام تدريجياً.
4. يجب توحيد API على Node إذا كان VPS يدعمه.
5. يجب إصلاح `npm run typecheck`.
6. يجب تقسيم الملفات الكبيرة.
7. يجب إنشاء Git repo نظيف إن لم يكن موجوداً.
8. يجب حفظ backup من قاعدة بيانات الإنتاج قبل أي migration.
9. يجب توثيق طريقة النشر الحالية قبل تغييرها.

## 15. الرؤية المقترحة لـ v2

v2 يجب أن تكون ترقية منظمة، لا إعادة بناء كاملة.

الخطة العامة:

1. تثبيت النسخة الحالية كـ baseline.
2. تنظيف TypeScript.
3. تنظيم الملفات.
4. توحيد API.
5. تقوية الصلاحيات.
6. تحسين التقارير والتنبيهات.
7. تجهيز mobile app بعد استقرار API.
8. إضافة ميزات أكبر مثل الطلبات، الموافقات، الدردشة، والمزامنة.

## 16. وصف مختصر جداً

RMDATA هو نظام إدارة داخلي شامل لشركة الرداء الموحد، يعمل كتطبيق سطح مكتب وواجهة ويب، ويدير الفروع والموظفين والكيانات والمستندات والتنبيهات والصلاحيات، مع قاعدة بيانات محلية أو مركزية على VPS. المشروع مبني بـ React/TypeScript/Electron، ويتجه تدريجياً إلى بنية API مركزية تدعم الويب والموبايل في v2.
