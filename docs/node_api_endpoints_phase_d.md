# Node API Endpoint Inventory - Phase D

آخر تحديث: 2026-05-22

الغرض: تثبيت قائمة endpoints التي يخدمها Node حالياً حتى يكون Node هو مسار التطوير الوحيد، ويبقى PHP Legacy فقط.

## Health

- `GET /api/health`

## Legacy

- `POST /api/db/query` - معزول في `server/routes/legacy-db-query.js`.

## Auth

- `POST /api/auth/login`
- `POST /api/auth/change-own-password`

## Files / Documents

- `GET /api/files/serve`
- `GET /api/files/open`
- `GET /api/files/list`
- `POST /api/files/upload`
- `POST /api/files/delete`

## Archive / Restore / Permanent Delete

- `POST /api/{employees,branches,vehicles,housing,phones,entities,employers}/:id/archive`
- `POST /api/{employees,branches,vehicles,housing,phones,entities,employers}/:id/restore`
- `DELETE /api/{employees,branches,vehicles,housing,phones,entities,employers}/:id/permanent`

## Core Resources

- Branches: `GET /api/branches`, `GET /api/branches/:id`, `POST /api/branches`, `PUT /api/branches/:id`, `DELETE /api/branches/:id`
- Employees: `GET /api/employees`, `GET /api/employees/:id`, `POST /api/employees`, `PUT /api/employees/:id`, `PUT /api/employees/:id/status`, `DELETE /api/employees/:id`
- Employers: `GET /api/employers`, `GET /api/employers/:id`, `POST /api/employers`, `PUT /api/employers/:id`, `DELETE /api/employers/:id`
- Housing: `GET /api/housing`, `GET /api/housing/:id`, `POST /api/housing`, `PUT /api/housing/:id`, `DELETE /api/housing/:id`
- Vehicles: `GET /api/vehicles`, `GET /api/vehicles/:id`, `POST /api/vehicles`, `PUT /api/vehicles/:id`, `DELETE /api/vehicles/:id`
- Phones: `GET /api/phones`, `GET /api/phones/:id`, `POST /api/phones`, `PUT /api/phones/:id`, `DELETE /api/phones/:id`

## Settings / Tax / Users

- Settings: `GET /api/settings`, `GET /api/settings/:key`, `POST /api/settings`, `DELETE /api/settings/:key`
- Tax payments: `GET /api/tax/payments`, `GET /api/tax/payments/:id`, `POST /api/tax/payments`, `PUT /api/tax/payments/:id`, `DELETE /api/tax/payments/:id`
- Tax entity branches: `GET /api/tax/entity-branches`, `POST /api/tax/entity-branches`, `PUT /api/tax/entity-branches/:entityId`, `DELETE /api/tax/entity-branches`
- Users: `GET /api/users`, `GET /api/users/:id`, `GET /api/users/:id/permissions`, `PUT /api/users/:id/permissions`
- Stats: `GET /api/stats/summary`

## Phase D Notes

- لا تضف endpoints جديدة إلى PHP.
- أي مسار جديد أو منقول يجب أن يستخدم Node + `requirePermission` أو `requireAnyPermission`.
- `/api/db/query` يبقى موجوداً فقط لتوافق Legacy، ويجب تقليل الاعتماد عليه تدريجياً.
