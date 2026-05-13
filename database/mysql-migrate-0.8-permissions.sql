-- Phase 0.8 → v4 — DEPRECATED migration file.
-- user_permission_overrides and permissionVersion were part of the old RBAC system.
-- They are now deprecated in v4 (Admin=all in code, User=user_permissions only).
-- Kept for backward compatibility — skip if already applied.

SET NAMES utf8mb4;

-- This table is DEPRECATED in v4 — no longer written to.
CREATE TABLE IF NOT EXISTS `user_permission_overrides` (
  `userId` INT NOT NULL,
  `permissionId` INT NOT NULL,
  `isAllowed` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`userId`, `permissionId`),
  KEY `FK_upo_user` (`userId`),
  KEY `FK_upo_permission` (`permissionId`),
  CONSTRAINT `FK_upo_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_upo_permission` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- permissionVersion is still used for cache invalidation
ALTER TABLE `users` ADD COLUMN `permissionVersion` INT NOT NULL DEFAULT 1;
