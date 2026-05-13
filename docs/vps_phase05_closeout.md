# إغلاق المرحلة 0.5 على VPS (Node + PM2 + Bridge + Backup)

هذا الدليل يغلق المتبقي من المرحلة 0.5 كما هو محدد في خارطة `v2_review_report1`.

## 1) تجهيز Node + PM2

على VPS (كمستخدم `deploy` أو مستخدم تشغيل مماثل):

```bash
cd /var/www/api.rmdata.tech/current
chmod +x scripts/vps-setup-node-pm2.sh
./scripts/vps-setup-node-pm2.sh 20 deploy
```

النتيجة المتوقعة:
- خدمة `rmdata-node-api` تعمل عبر PM2.
- `pm2 save` مفعل.
- startup تم توليده لـ systemd.

## 2) ربط Nginx بنفس الدومين (Bridge)

1. افتح vhost الخاص بـ `api.rmdata.tech`.
2. أضف محتوى الملف التالي داخل `server { ... }`:
   - `[scripts/vps-nginx-node-bridge.conf](../scripts/vps-nginx-node-bridge.conf)`
3. اختبر ثم أعد تحميل:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 3) توحيد قاعدة البيانات (PHP + Node)

خدمة Node (`server/dev-api-server.js`) تستخدم **MariaDB** عبر نفس متغيرات PHP: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`، وتُضبط في PM2 داخل  
`[scripts/vps-node-api-ecosystem.config.cjs](../scripts/vps-node-api-ecosystem.config.cjs)`  
بحيث تطابق قيم `api-gateway-php/.env`.

للملفات (مسارات `documents/` و`images/`): عيّن **`RMDATA_STORAGE_ROOT`** إلى المسار المطلق لمجلد `storage` الخاص بـ PHP (مثل `.../api-gateway-php/storage`).

اختبار سريع:

```bash
curl -fsS https://api.rmdata.tech/api/health
curl -fsS https://api.rmdata.tech/node-api/health
```

اختبار تطابق قاعدة البيانات بين المسارين:

```bash
chmod +x /var/www/api.rmdata.tech/current/scripts/vps-validate-shared-db.sh
LOGIN_USER=admin LOGIN_PASS='***' /var/www/api.rmdata.tech/current/scripts/vps-validate-shared-db.sh
```

## 4) النسخ الاحتياطي اليومي + احتفاظ 15 يوم

```bash
chmod +x /var/www/api.rmdata.tech/current/scripts/vps-backup-daily.sh
```

إضافة cron يومي (مثال الساعة 02:30):

```bash
crontab -e
```

ثم أضف:

```cron
30 2 * * * DB_NAME=rmdata_db DB_USER=root RETENTION_DAYS=15 /var/www/api.rmdata.tech/current/scripts/vps-backup-daily.sh >> /var/log/rmdata/backup.log 2>&1
```

مخرجات النسخ:
- `/var/backups/rmdata/<timestamp>/db.sql`
- `/var/backups/rmdata/<timestamp>/storage.tar.gz`
- نسخ env (إن وجدت)

## 5) Verification checklist (إغلاق 0.5)

```bash
chmod +x /var/www/api.rmdata.tech/current/scripts/vps-verify-phase05.sh
/var/www/api.rmdata.tech/current/scripts/vps-verify-phase05.sh
```

التحقق المطلوب:
- Health:
  - `api/health` = سليم
  - `node-api/health` = سليم
- Persistence:
  - `nginx` + `php-fpm` + `pm2` + `rmdata-node-api` تعمل بعد reboot
- Restore smoke test:
  - استخراج `db.sql` و`storage.tar.gz` من آخر backup بنجاح

## 6) معايير إغلاق المرحلة

تُعتبر المرحلة `0.5` مغلقة عندما:
- Node API تعمل كخدمة PM2 مستقرة.
- Nginx bridge على نفس الدومين فعال بدون كسر PHP الحالي.
- نسخ احتياطي يومي يعمل تلقائيا مع retention 15 يوم.
- تم تنفيذ التحقق النهائي وتوثيق النتيجة.

