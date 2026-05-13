-- ترقية جدول موجود مسبقاً (بدون الأعمدة الجديدة).
-- إذا ظهر الخطأ #1146 (الجدول غير موجود): نفّذ أولاً:
--   database/mysql-create-connected-devices.sql
--
-- إذا كان الجدول موجوداً بدون deviceId / deviceLabel / publicIp فقط، نفّذ ما يلي:

ALTER TABLE connected_devices
  ADD COLUMN deviceId VARCHAR(64) NULL,
  ADD COLUMN deviceLabel VARCHAR(255) NULL,
  ADD COLUMN publicIp VARCHAR(64) NULL;

-- After backfill/cleanup, you may add:
-- CREATE UNIQUE INDEX idx_connected_devices_user_device ON connected_devices (userId, deviceId);
