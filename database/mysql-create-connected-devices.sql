-- جلسات الأجهزة المتصلة (MySQL / Hostinger)
-- نفّذ مرة واحدة إذا لم يكن الجدول موجوداً (#1146).
-- متوافق مع منطق Electron: upsert حسب (userId + deviceId) + فهرس فريد.

CREATE TABLE IF NOT EXISTS connected_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  username VARCHAR(255) NULL,
  deviceId VARCHAR(64) NULL,
  deviceName VARCHAR(255) NULL,
  deviceLabel VARCHAR(255) NULL,
  ipAddress VARCHAR(64) NULL,
  publicIp VARCHAR(64) NULL,
  appVersion VARCHAR(50) NULL,
  token VARCHAR(255) NULL,
  gpsCoordinates TEXT NULL,
  locationCity VARCHAR(255) NULL,
  lastActive DATETIME NULL,
  createdAt DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- الخطوة 2: نفّذ بعد الخطوة 1 (مرة واحدة؛ إن ظهر «Duplicate key name» فالفهرس موجود ولا مشكلة).
CREATE UNIQUE INDEX idx_connected_devices_user_device ON connected_devices (userId, deviceId);
