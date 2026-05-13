# الوضع الحالي للنسخة v1.4.1 - RMDATA

آخر تحديث: 2026-05-13

## 1. الهدف من هذا الملف

هذا الملف يوثق الوضع الحالي قبل بدء تنظيف V2. الهدف أن يعرف أي مبرمج أو أداة ذكاء اصطناعي كيف يعمل النظام الآن، وما الذي يجب عدم كسره أثناء التطوير.

## 2. حالة المشروع الحالية

- اسم المشروع: RMDATA System.
- الإصدار الحالي في `package.json`: `1.4.1`.
- المستودع على GitHub: `https://github.com/khatib96/rmdata.git`.
- التطبيق يعمل حالياً ومرفوع على VPS.
- النسخة المثبتة الحالية لا يتم لمسها مباشرة أثناء التطوير.
- التطوير القادم يتم داخل Git، ثم يتم عمل build وإصدار جديد بعد الاختبار.

## 3. التقنيات الحالية

### الواجهة

- React 18.
- TypeScript.
- Vite.
- Tailwind CSS.
- Zustand.
- React Router.
- i18next.
- Lucide React.

### سطح المكتب

- Electron.
- Electron preload.
- IPC handlers.
- Electron auto updater.

### قواعد البيانات

- SQLite للوضع المحلي.
- MySQL/MariaDB للوضع البعيد على VPS.

### API

- Node.js/Express API في مجلد `server`.
- PHP gateway في مجلد `api-gateway-php`.

الهدف المستقبلي:

- Node API يكون المسار الأساسي.
- PHP gateway يبقى legacy/fallback إذا لزم.

## 4. أوامر التشغيل والبناء

من جذر المشروع:

```powershell
npm install
npm run dev
```

تشغيل الواجهة فقط:

```powershell
npm run dev:react
```

تشغيل API التطوير:

```powershell
npm run dev:api
```

بناء الواجهة:

```powershell
npm run build:react
```

بناء Electron:

```powershell
npm run build:electron
```

فحص TypeScript:

```powershell
npm run typecheck
```

اختبار مترجم SQLite إلى MySQL:

```powershell
npm run test:sqlite-mysql
```

## 5. نتائج الفحص المعروفة

آخر نتائج معروفة قبل بدء V2:

- `npm run build:react`: نجح.
- `npm run build:electron`: نجح.
- `npm run test:sqlite-mysql`: نجح.
- `npm run typecheck`: يفشل حالياً ويحتاج إصلاح في المرحلة 1.

ملاحظة:

نجاح build لا يعني أن TypeScript سليم، لأن Vite قد يبني رغم أخطاء الأنواع.

## 6. وضع Git الحالي

تم تنفيذ:

- Git initialization.
- baseline commit.
- push إلى GitHub.
- إضافة `.gitignore`.
- إضافة `.gitattributes`.
- إضافة `SECURITY.md`.
- إضافة `AI_MEMORY.md`.

يجب الحفاظ على:

- commit صغير لكل مهمة.
- push يومي أو بعد كل إنجاز مهم.
- عدم تعديل النسخة المثبتة مباشرة.

## 7. الملفات والمجلدات التي لا يجب تعديلها كمصدر

هذه المجلدات هي مخرجات أو حزم أو ملفات إنتاجية، وليست المصدر الأساسي للتطوير:

- `node_modules/`
- `dist/`
- `dist-electron/`
- `release/`
- `release2/`
- `api-gateway-php/vendor/`

لا يتم تعديلها يدوياً ضمن خطة V2.

## 8. الملفات الحساسة

هذه الملفات يجب تعديلها بحذر:

- `electron/remote-api-utils.ts`
- `electron/ipc/auth-ipc.ts`
- `electron/ipc/settings-ipc.ts`
- `electron/ipc/document-ipc.ts`
- `electron/ipc/file-ipc.ts`
- `server/dev-api-server.js`
- `server/permissions-resolver.js`
- `server/permission-middleware.js`
- `api-gateway-php/api/index.php`
- `api-gateway-php/src/auth.php`
- `api-gateway-php/src/db.php`
- `src/permissions/permissionCatalogV2.ts`

## 9. وضع السيرفر والتحديثات

حسب تأكيد صاحب المشروع بتاريخ 2026-05-13:

- السيرفر يعمل حالياً.
- النسخ الاحتياطي على السيرفر شغال.
- التحديثات مضبوطة لتذهب إلى السيرفر.
- النسخة المثبتة الحالية ستبقى كما هي إلى أن يتم بناء إصدار جديد.

### معلومات السيرفر المؤكدة

تم فحص السيرفر بتاريخ 2026-05-13 عبر SSH:

```text
SSH user: deploy
Host: api.rmdata.tech
Hostname: api
Public IPv4: 72.62.197.145
OS: Ubuntu 24.04.4 LTS
Node.js: v20.20.2
npm: 10.8.2
PM2: 6.0.14
```

حالة الموارد وقت الفحص:

```text
Disk /: 96G total, 7.8G used, 89G available, 9% used
Memory: 7.8Gi total, about 837Mi used, 6.9Gi available
Swap: 0B
```

ملاحظة تشغيلية:

```text
System restart required
13 updates can be applied immediately
```

لا يتم تنفيذ reboot أو updates أثناء العمل العادي بدون نافذة صيانة، لأن السيرفر يشغل API الإنتاج.

### مسارات السيرفر

```text
/var/www/api.rmdata.tech
/var/www/api.rmdata.tech/current
/var/www/api.rmdata.tech/html
/var/www/api.rmdata.tech/storage
```

محتوى `current` وقت الفحص:

```text
/var/www/api.rmdata.tech/current/database
/var/www/api.rmdata.tech/current/node_modules
/var/www/api.rmdata.tech/current/package-lock.json
/var/www/api.rmdata.tech/current/package.json
/var/www/api.rmdata.tech/current/scripts
/var/www/api.rmdata.tech/current/server
```

مسار الملفات:

```text
/var/www/api.rmdata.tech/storage/documents
/var/www/api.rmdata.tech/storage/images
```

### PM2

العمليات الموجودة:

```text
rmdata-node-api: online, user deploy
alredaa-backend: online, user deploy
```

تفاصيل `rmdata-node-api`:

```text
Name: rmdata-node-api
Status: online
PM2 id: 0
Version shown by PM2: 1.3.0
Script: /var/www/api.rmdata.tech/current/server/dev-api-server.js
CWD: /var/www/api.rmdata.tech/current
Node env: production
Node version: 20.20.2
Error log: /var/log/rmdata/node-api-error.log
Out log: /var/log/rmdata/node-api-out.log
REST: http://0.0.0.0:3001/api/...
WebSocket: ws://0.0.0.0:3001
Storage root: /var/www/api.rmdata.tech/storage
```

ملاحظة logs:

- توجد أخطاء قديمة بتاريخ 2026-04-12 حول `seedPermissionCatalog is not a function`.
- آخر logs لاحقة تظهر `Permission catalog seed: OK`.
- العملية تعمل منذ حوالي 26 يوم وقت الفحص.
- عدد restarts الظاهر في PM2 كان 135، ويحتاج مراقبة لاحقة إذا تكرر بعد أي نشر جديد.

### Nginx

حالة Nginx وقت الفحص:

```text
nginx.service: active (running)
started since 2026-04-30 11:14:17 UTC
site enabled: /etc/nginx/sites-enabled/api.rmdata.tech -> /etc/nginx/sites-available/api.rmdata.tech
```

### مسار التحديثات

المسار الفعلي المؤكد من فحص ملفات السيرفر:

```text
/var/www/api.rmdata.tech/html/updates
```

ملاحظة:

- المسار السابق `/var/www/api.rmdata.tech/public/updates/win` غير موجود.
- مجلد `updates` موجود داخل `html`.
- إذا كانت تحديثات Windows مقسمة حسب المنصة، فالمسار المتوقع داخل هذا المجلد سيكون مثل `/var/www/api.rmdata.tech/html/updates/win`.
- يجب عدم حذف أو استبدال محتوى هذا المجلد إلا أثناء نشر release جديد وبعد build واختبار.

ملفات وسكربتات مرتبطة بالسيرفر:

- `scripts/vps-setup-node-pm2.sh`
- `scripts/vps-node-api-ecosystem.config.cjs`
- `scripts/vps-nginx-node-bridge.conf`
- `scripts/vps-backup-daily.sh`
- `scripts/vps-verify-phase05.sh`
- `scripts/vps-validate-shared-db.sh`

مسار التحديثات المعروف من `package.json`:

```text
https://api.rmdata.tech/updates/win
```

## 10. وضع Local وRemote

### Local Mode

المسار:

```text
React -> Electron IPC -> SQLite
```

مناسب للنسخة المحلية المستقلة.

### Remote Mode

المسار:

```text
React/Electron -> API -> MySQL/MariaDB
```

أو عند فتح الواجهة من المتصفح:

```text
Browser React -> browserApiPolyfill -> API -> MySQL/MariaDB
```

الهدف في V2:

- تقوية Remote Mode.
- جعل Node API هو المسار الأساسي.
- تقليل الاعتماد على raw SQL عبر `/api/db/query`.

## 11. ما لا يجب كسره في V2

- تسجيل الدخول.
- صلاحيات المستخدمين.
- Local SQLite mode.
- Remote API mode.
- رفع وفتح المستندات.
- التنبيهات.
- النسخ الاحتياطي.
- التحديثات التلقائية.
- بيانات الإنتاج على VPS.

## 12. المرحلة التالية

بعد اكتمال المرحلة 0:

1. تشغيل `npm run typecheck`.
2. تصنيف الأخطاء.
3. إصلاح أخطاء runtime المحتملة أولاً.
4. عدم إضافة ميزات جديدة قبل جعل `typecheck` أخضر.

## 13. ملاحظات للمطور أو AI

إذا بدأت العمل على هذا المشروع:

- اقرأ `AI_MEMORY.md` أولاً.
- اقرأ `docs/v2-repair-and-development-roadmap.md`.
- اقرأ `docs/project-brief-for-developers-ai.md`.
- لا تبدأ بتقسيم الملفات أو تعديل API قبل التأكد من أن Git clean.
- بعد كل جلسة، حدّث `AI_MEMORY.md`.
