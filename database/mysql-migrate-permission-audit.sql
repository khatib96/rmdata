-- Audit trail for permission mapping changes (optional; dev-api-server logs best-effort when table exists)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `permission_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `actorUserId` INT NOT NULL,
  `targetUserId` INT NULL DEFAULT NULL,
  `action` VARCHAR(64) NOT NULL,
  `details` TEXT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_permission_audit_created` (`createdAt`),
  KEY `idx_permission_audit_actor` (`actorUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
