# Phase 0.6 Endpoint Inventory (Bridge)

> آخر تحديث: أبريل 2026  
> الهدف: مرجع تنفيذي واحد يحدد Ownership الحالي، هدف الترحيل، وقاعدة fallback لكل endpoint.

## حالة التنفيذ الحالية (Phase A)

- [x] بناء Inventory فعلي للمسارات المستخدمة من التطبيق.
- [x] تحديد Ownership الحالي وهدف 0.6 لكل endpoint.
- [x] توثيق سياسة Bridge (`PHP default` + `Node canary`) وقواعد fallback.
- [ ] تنفيذ cutover فعلي للمسارات المرشحة إلى Node (ينفذ في المرحلة B/C بعد إغلاق شروط الجاهزية).
- [x] إغلاق blocker `POST /api/files/upload` في Node (جاهز لاختبارات smoke قبل أي cutover).

## Canary rollout (Step 1)

- Endpoint المختار: `/api/health` (منخفض المخاطر).
- الهدف: أول cutover فعلي في الإنتاج مع rollback سريع.
- إجراء Nginx: استخدام snippet من `scripts/vps-nginx-node-bridge.conf` وإضافته أعلى `location /api/`.
- تحقق بعد التفعيل:
  - `curl -sS https://api.rmdata.tech/api/health`
  - `curl -sS https://api.rmdata.tech/node-api/health`
  - `pm2 logs rmdata-node-api --lines 80`
- Rollback:
  - إزالة/تعليق `location = /api/health`
  - `nginx -t && systemctl reload nginx`

## Scope

- هذا الملف يغطي endpoints المستهلكة فعليا من التطبيق (Electron remote mode) + endpoints تشغيلية.
- قاعدة العمل في 0.6: `PHP default` و `Node canary` بشكل انتقائي لكل endpoint.

## Inventory Matrix

| Endpoint | Method | Consumer | Used In App Now | Current Owner | Target Owner (0.6) | Cutover Rule | Fallback |
|---|---|---|---|---|---|---|---|
| `/api/health` | GET | Ops / scripts | نعم | PHP | Node (canary first) | نقل تدريجي بنسبة منخفضة، مراقبة 5xx | إرجاع التوجيه لـ PHP مباشرة |
| `/api/auth/login` | POST | Electron | نعم | PHP | PHP (خلال 0.6) | يبقى على PHP حتى حسم عقد المصادقة | لا تغيير (PHP primary) |
| `/api/auth/change-own-password` | POST | Electron | نعم | PHP | PHP (خلال 0.6) | يبقى على PHP لتجنب drift بالعقد | لا تغيير (PHP primary) |
| `/api/db/query` | POST | Electron IPC | نعم | PHP | Node canary محدود (استعلامات معتمدة) | نقل endpoint-by-endpoint حسب query families | rollback فوري على مستوى route |
| `/api/files/list` | GET | Electron | نعم | PHP | PHP (حالياً) | لا ينقل قبل parity كامل للملفات | لا تغيير (PHP primary) |
| `/api/files/upload` | POST | Electron | نعم | PHP | Node canary بعد smoke | endpoint متاح في Node ويحتاج تحقق VPS قبل التحويل | revert endpoint إلى PHP فوراً عند أي فشل upload |
| `/api/files/open` | GET | Electron | نعم | PHP | PHP (حالياً) | لا ينقل قبل parity التخزين وmime | لا تغيير (PHP primary) |
| `/api/files/delete` | POST | Electron | نعم | PHP | PHP (حالياً) | لا ينقل قبل parity كامل + اختبارات | لا تغيير (PHP primary) |
| `/api/housing*` | GET/POST/PUT/DELETE | Electron | نعم | PHP | Node (canary done) | تم تنفيذ canary ناجح على الإنتاج (list + CRUD + archive) | rollback فوري بإزالة block route من Nginx |
| `/api/employees*` | GET/POST/PUT/DELETE | Electron | نعم | PHP | Node (canary done) | تم تنفيذ canary ناجح على الإنتاج (list + CRUD) | rollback فوري بإزالة block route من Nginx |
| `/api/phones*` | GET/POST/PUT/DELETE | Electron | نعم | PHP | Node (canary done) | تم تنفيذ canary ناجح على الإنتاج (list + CRUD + archive) | rollback فوري بإزالة block route من Nginx |
| `/api/settings*` | GET/POST/DELETE | Electron | نعم | PHP | Node (canary done) | تم تنفيذ canary ناجح على الإنتاج (list/get/upsert/delete) | rollback فوري بإزالة block route من Nginx |
| `/api/tax/*` | GET/POST/PUT/DELETE | Electron | نعم | PHP | Node (canary done) | تم تنفيذ canary ناجح على الإنتاج (`tax_payments` + `tax_entity_branches`) | rollback فوري بإزالة block route من Nginx |
| `/api/vehicles*` | GET/POST/PUT/DELETE | Electron | نعم | PHP | Node (canary done) | تم تنفيذ canary ناجح على الإنتاج مع CRUD + archive | rollback فوري بإزالة block route من Nginx |
| `/node-api/*` | جميعها | Ops / manual testing | لا (من العميل) | Node | Node testing lane | يستخدم فقط للاختبار والتحقق أثناء 0.6 | وقف الاختبار والاعتماد على `/api/*` |

## Bridge Policy (0.6)

## 1) Policy

- **Default policy:** جميع مسارات التطبيق الفعلية تبقى على PHP حتى يثبت parity.
- **Canary policy:** Node يستخدم فقط لمسارات منخفضة المخاطر أو اختبارية، وبنسبة محدودة.
- **No Big-Bang:** ممنوع تحويل شامل دفعة واحدة.

## 2) Readiness Gate قبل أي Cutover

أي endpoint لا ينتقل إلى Node قبل تحقق هذه الشروط الثلاثة:

1. **Contract parity**: نفس shape للـ JSON (`success`, `error`, `data`, `lastInsertId` حسب الحالة).
2. **Schema parity**: الاستعلامات مطابقة للجداول/الأعمدة الفعلية في MariaDB.
3. **Rollback path**: خطوة revert واحدة واضحة ومجربة.

## 3) Route Ownership Rules

- `Auth` خلال 0.6: يبقى على PHP.
- `Files` خلال 0.6: يبقى على PHP حتى إغلاق فجوة `files/upload` في Node وتأكيد parity.
- `db/query`: مسار التحويل الأول إلى Node canary ولكن على نطاق صغير ومراقب.

## 4) Rollback Conditions

- ارتفاع `5xx` أو أخطاء SQL مباشرة بعد cutover.
- فشل login/token أو عدم تطابق response shape.
- أخطاء وصول للملفات أو فشل upload/open/delete.

عند تحقق أي شرط:

1. إعادة route المعني إلى PHP.
2. مسح أثر التجربة من PM2/Nginx logs.
3. إعادة اختبار smoke سريع (`health`, `login`, `db/query`, `files/list`).

## Evidence (code references)

- Electron يستخدم `/api/*`: `electron/remote-api-utils.ts`, `electron/ipc/auth-ipc.ts`, `electron/ipc/document-ipc.ts`
- PHP endpoints الفعلية: `api-gateway-php/api/index.php`
- Node bridge lane: `scripts/vps-nginx-node-bridge.conf`, `server/dev-api-server.js`
