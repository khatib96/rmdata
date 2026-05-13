# Phase 0.7 Compatibility Matrix

> تحديث: أبريل 2026  
> الصيغة: `Endpoint -> SQL/Table -> Status -> Fix`.

| Domain | Endpoint | SQL/Table Contract | Status | Action/Fix |
|---|---|---|---|---|
| auth | `POST /api/auth/login` | `users + roles`، مطابقة `username` أو `employee.code` أو `employer.code` | Ready (Node parity) | تم توحيد matching + JWT issuance claims (`sub`, `username`, `roleId`, `roleName`) |
| auth | `POST /api/auth/change-own-password` | `users.passwordHash` مع تحقق token | Ready (Node parity) | `requireAuth` يدعم JWT + fallback legacy token |
| files | `GET /api/files/list` | `documents` | Ready | مطابق لعقد Electron |
| files | `POST /api/files/upload` | `documents` + `storage` | Ready (new) | تمت إضافة endpoint في Node مع `kind=image`, `skipDbInsert`, archive behavior, size/ext limits |
| files | `GET /api/files/open` | `storage` | Ready | يدعم token عبر Authorization/query |
| files | `POST /api/files/delete` | `documents` + حذف ملف | Ready | سلوك متوافق |
| db/query | `POST /api/db/query` | SQL translated عبر `sqliteToMysql` | Ready (guarded) | يبقى بحدود queries المسموحة، مع منع `PRAGMA/ATTACH...` |
| resources | `GET/POST/PUT/DELETE /api/housing*` | **should use `housing_units`** | Ready (canary on `/api/housing*`) | تم التحويل من `housing` إلى `housing_units` + `rentAmount` + archive via `status='archived'`؛ smoke + canary ناجحة |
| resources | `/api/branches*` | schema لا يحتوي `isArchived`/`managerName` | Ready (canary on `/api/branches*`) | تم refactor إلى `status` وإزالة `managerName` واعتماد أعمدة schema الفعلية؛ smoke + canary ناجحة على المسار الإنتاجي |
| resources | `/api/employees*` | schema لا يحتوي `isArchived/idNumber/housingId/vehicleId/employerId/startDate/salary` | Ready (canary on `/api/employees*`) | تم تحويل filters/CRUD إلى `status` + mapping للأعمدة الفعلية مع aliases توافقية (`idNumber/startDate/salary`)؛ smoke + canary ناجحة |
| resources | `/api/employers*` | schema لا يحتوي `isArchived/idNumber` | Ready (canary on `/api/employers*`) | تم تحويل filters/CRUD إلى `status` مع توافق حقول schema، وإبقاء `idNumber` كـ alias لـ `emiratesId` للتوافق؛ smoke + canary ناجحة على المسار الإنتاجي |
| resources | `/api/phones*` | schema يعتمد `phoneNumber/assigned*` ولا يحتوي `isArchived` | Ready (canary on `/api/phones*`) | تمت إضافة CRUD في Node + تحويل archive/filter إلى `status` + aliases توافقية (`phone/branchId/...`)؛ smoke + canary ناجحة |
| resources | `/api/vehicles*` | schema لا يحتوي `isArchived/color` | Ready (canary on `/api/vehicles*`) | تم تحويل filters/CRUD إلى `status` مع alias توافقي `color -> vehicleType`؛ smoke + canary ناجحة على المسار الإنتاجي |
| tax | `/api/tax/payments*` + `/api/tax/entity-branches*` | `tax_payments` + `tax_entity_branches` | Ready (canary on `/api/tax/*`) | تمت إضافة CRUD + link/unlink في Node؛ smoke + canary ناجحة على الإنتاج |
| settings | `/api/settings*` | `settings (key,value)` | Ready (canary on `/api/settings*`) | تمت إضافة list/get/upsert/delete في Node؛ smoke + canary ناجحة على الإنتاج |
| stats | `GET /api/stats/summary` | counts by non-archived | Partially fixed | تم التحويل إلى `status != archived` و`housing_units`، يحتاج تحقق شامل بعد إصلاح باقي resources |

## Next in Phase B

1. تثبيت smoke tests للمسارات `auth/files/db-query` على Node lane.
2. تثبيت report نهائي لمرحلة 0.7 بعد نجاح canary لنطاق `tax/settings`.
3. الانتقال للمرحلة التالية (0.8) مع إبقاء مراقبة تشغيلية مستمرة.

## Validation Snapshot

- Local syntax check: `node --check server/dev-api-server.js` [OK]
- Unit tests: `npm run test:sqlite-mysql` [OK] (6/6 passed)
- VPS smoke checks (`login`, `files/upload`, `files/open`, `db/query`, `branches CRUD`, `employers CRUD`, `vehicles CRUD`, `employees CRUD`, `phones CRUD`, `housing CRUD`, `settings`, `tax`) [OK] for completed scope.
