-- RMDATA System - MySQL schema for Hostinger (u171504308_rmdata_db)
-- Generated from TypeORM entities + migrations. Import via phpMyAdmin > Import.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Auth & Permissions v4 — Admin (roleId=1) / User (roleId=2)
-- Admin gets ALL permissions automatically in code — no role_permissions needed.
-- Users get ONLY what is explicitly granted in user_permissions.
-- Tables role_permissions and user_permission_overrides are DEPRECATED (kept for backward compat).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `isSystem` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `module` VARCHAR(100) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `labelKey` VARCHAR(200) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_permissions_module_action` (`module`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DEPRECATED: role_permissions is no longer used by the v4 system.
-- Admin gets everything in code. Kept for backward compatibility only.
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `roleId` INT NOT NULL,
  `permissionId` INT NOT NULL,
  PRIMARY KEY (`roleId`, `permissionId`),
  KEY `FK_role_permissions_role` (`roleId`),
  KEY `FK_role_permissions_permission` (`permissionId`),
  CONSTRAINT `FK_role_permissions_role` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_role_permissions_permission` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PRIMARY permission table: explicit grants for non-admin users
CREATE TABLE IF NOT EXISTS `user_permissions` (
  `userId` INT NOT NULL,
  `permissionId` INT NOT NULL,
  PRIMARY KEY (`userId`, `permissionId`),
  KEY `FK_user_permissions_user` (`userId`),
  KEY `FK_user_permissions_permission` (`permissionId`),
  CONSTRAINT `FK_user_permissions_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_user_permissions_permission` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(100) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `fullName` VARCHAR(200) NOT NULL,
  `email` VARCHAR(255) NULL,
  `roleId` INT NOT NULL,
  `isActive` TINYINT(1) DEFAULT 1,
  `userType` VARCHAR(20) DEFAULT 'free',
  `linkedEntityType` VARCHAR(20) NULL,
  `linkedEntityId` INT NULL,
  `mustChangePassword` TINYINT(1) DEFAULT 0,
  `avatarPath` VARCHAR(255) NULL,
  `passwordChangedAt` DATETIME NULL,
  `lastLoginAt` DATETIME NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `permissionVersion` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_users_username` (`username`),
  KEY `FK_users_role` (`roleId`),
  CONSTRAINT `FK_users_role` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DEPRECATED: user_permission_overrides is no longer used by v4.
-- Kept for backward compatibility only — no new data written here.
CREATE TABLE IF NOT EXISTS `user_permission_overrides` (
  `userId` INT NOT NULL,
  `permissionId` INT NOT NULL,
  `isAllowed` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`userId`, `permissionId`),
  KEY `FK_user_permission_overrides_user` (`userId`),
  KEY `FK_user_permission_overrides_permission` (`permissionId`),
  CONSTRAINT `FK_user_permission_overrides_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_user_permission_overrides_permission` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Core: branches, entities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `branches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NULL,
  `name` VARCHAR(200) NOT NULL,
  `nameEn` VARCHAR(200) NULL,
  `phone` VARCHAR(20) NULL,
  `country` VARCHAR(100) DEFAULT 'United Arab Emirates',
  `emirate` VARCHAR(50) NOT NULL,
  `city` VARCHAR(100) NULL,
  `address` TEXT NULL,
  `tradeLicenseNo` VARCHAR(100) NULL,
  `tradeLicenseExpiry` DATE NULL,
  `establishmentCardNo` VARCHAR(100) NULL,
  `establishmentCardExpiry` DATE NULL,
  `branchType` VARCHAR(20) DEFAULT 'store',
  `isAttached` TINYINT(1) DEFAULT 0,
  `attachedToId` INT NULL,
  `photoPath` VARCHAR(255) NULL,
  `workHours` VARCHAR(20) NULL,
  `workTimingSlots` TEXT NULL,
  `status` VARCHAR(50) DEFAULT 'active',
  `googleMapUrl` TEXT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_branches_code` (`code`),
  KEY `FK_branches_attachedTo` (`attachedToId`),
  CONSTRAINT `FK_branches_attachedTo` FOREIGN KEY (`attachedToId`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `entities` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entityNickname` VARCHAR(200) NULL,
  `name` VARCHAR(200) NOT NULL,
  `nameEn` VARCHAR(200) NULL,
  `registeredAddress` TEXT NULL,
  `contactNumber` VARCHAR(50) NULL,
  `tradeLicenseNumber` VARCHAR(50) NULL,
  `tradeLicenseExpiry` DATE NULL,
  `trn` VARCHAR(15) NULL,
  `vatTrn` VARCHAR(50) NULL,
  `vatRegDate` DATE NULL,
  `corporateTaxGiban` VARCHAR(50) NULL,
  `corporateTaxTrn` VARCHAR(50) NULL,
  `vatFilingCycle` VARCHAR(20) NULL,
  `corporateTaxRegDate` DATE NULL,
  `financialYearEnd` VARCHAR(20) NULL,
  `mainBranchId` INT NULL,
  `status` VARCHAR(50) DEFAULT 'active',
  `notes` TEXT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_entities_mainBranch` (`mainBranchId`),
  CONSTRAINT `FK_entities_mainBranch` FOREIGN KEY (`mainBranchId`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Employers, Employees, BranchEmployers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NULL,
  `photoPath` VARCHAR(255) NULL,
  `fullName` VARCHAR(200) NOT NULL,
  `fullNameEn` VARCHAR(200) NULL,
  `nationality` VARCHAR(50) NULL,
  `phone` VARCHAR(20) NULL,
  `email` VARCHAR(100) NULL,
  `passportNumber` VARCHAR(50) NULL,
  `passportIssueDate` DATE NULL,
  `passportExpiry` DATE NULL,
  `passportCountry` VARCHAR(50) NULL,
  `emiratesId` VARCHAR(50) NULL,
  `emiratesIdIssueDate` DATE NULL,
  `emiratesIdExpiry` DATE NULL,
  `issueEmirate` VARCHAR(50) NULL,
  `occupation` VARCHAR(200) NULL,
  `notes` TEXT NULL,
  `primaryPhoneId` INT NULL,
  `status` VARCHAR(20) DEFAULT 'active',
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_employers_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `employees` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NULL,
  `imagePath` VARCHAR(255) NULL,
  `name` VARCHAR(200) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `email` VARCHAR(100) NULL,
  `nationality` VARCHAR(50) NULL,
  `passportNumber` VARCHAR(50) NULL,
  `passportIssueDate` DATE NULL,
  `passportExpiry` DATE NULL,
  `passportCountry` VARCHAR(50) NULL,
  `profession` VARCHAR(100) NULL,
  `contractType` VARCHAR(20) NULL,
  `contractStartDate` DATE NULL,
  `contractExpiryDate` DATE NULL,
  `workLicense` VARCHAR(50) NULL,
  `workCardNumber` VARCHAR(50) NULL,
  `workCardExpiry` DATE NULL,
  `contractBranchId` INT NULL,
  `workBranchId` INT NULL,
  `legalEntityId` INT NULL,
  `establishmentId` INT NULL,
  `emiratesId` VARCHAR(50) NULL,
  `emiratesIdIssueDate` DATE NULL,
  `emiratesIdExpiry` DATE NULL,
  `issueEmirate` VARCHAR(50) NULL,
  `employerName` VARCHAR(200) NULL,
  `establishmentNumber` VARCHAR(100) NULL,
  `immigrationEstablishmentNumber` VARCHAR(100) NULL,
  `professionKeys` TEXT NULL,
  `professionCustomTitle` VARCHAR(200) NULL,
  `professionPerContract` VARCHAR(200) NULL,
  `healthInsuranceEnabled` INT DEFAULT 0,
  `healthInsuranceProvider` VARCHAR(200) NULL,
  `healthInsuranceIssueDate` DATE NULL,
  `healthInsuranceExpiryDate` DATE NULL,
  `unemploymentInsuranceEnabled` INT NULL,
  `unemploymentInsuranceProvider` VARCHAR(200) NULL,
  `unemploymentInsuranceIssueDate` DATE NULL,
  `unemploymentInsuranceExpiryDate` DATE NULL,
  `loanType` VARCHAR(20) NULL,
  `targetEntityName` VARCHAR(200) NULL,
  `loanExpiryDate` DATE NULL,
  `tempContractNumber` VARCHAR(50) NULL,
  `loanSalary` DECIMAL(10,2) NULL,
  `loanBranchId` INT NULL,
  `loanProfession` VARCHAR(200) NULL,
  `loanSubStatus` VARCHAR(20) NULL,
  `loanLeaveStartDate` DATE NULL,
  `loanLeaveEndDate` DATE NULL,
  `basicSalary` DECIMAL(10,2) NULL,
  `housingAllowance` DECIMAL(10,2) NULL,
  `transportAllowance` DECIMAL(10,2) NULL,
  `otherAllowances` DECIMAL(10,2) NULL,
  `totalSalary` DECIMAL(10,2) NULL,
  `actualSalary` DECIMAL(10,2) NULL,
  `status` VARCHAR(20) DEFAULT 'active',
  `notes` TEXT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_employees_code` (`code`),
  KEY `IX_employees_workBranch` (`workBranchId`),
  KEY `IX_employees_legalEntity` (`legalEntityId`),
  CONSTRAINT `FK_employees_workBranch` FOREIGN KEY (`workBranchId`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_employees_legalEntity` FOREIGN KEY (`legalEntityId`) REFERENCES `entities` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `branch_employers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `employerId` INT NOT NULL,
  `role` VARCHAR(30) DEFAULT 'owner',
  `ownershipPercent` DECIMAL(5,2) NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_branch_employers_branch` (`branchId`),
  KEY `FK_branch_employers_employer` (`employerId`),
  CONSTRAINT `FK_branch_employers_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_branch_employers_employer` FOREIGN KEY (`employerId`) REFERENCES `employers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Vehicles, Phones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NULL,
  `photoPath` VARCHAR(255) NULL,
  `plateNumber` VARCHAR(50) NOT NULL,
  `plateCode` VARCHAR(20) NULL,
  `vehicleName` VARCHAR(200) NULL,
  `brand` VARCHAR(100) NULL,
  `model` VARCHAR(100) NULL,
  `year` INT NULL,
  `vehicleType` VARCHAR(20) NULL,
  `ownershipType` VARCHAR(20) NULL,
  `ownerName` VARCHAR(200) NULL,
  `issuePlace` VARCHAR(100) NULL,
  `trafficNo` VARCHAR(100) NULL,
  `chassisNo` VARCHAR(100) NULL,
  `engineNo` VARCHAR(100) NULL,
  `licenseRegDate` DATE NULL,
  `licenseExpiryDate` DATE NULL,
  `insuranceCompany` VARCHAR(200) NULL,
  `insuranceExpiryDate` DATE NULL,
  `insuranceType` VARCHAR(50) NULL,
  `insurancePolicyNo` VARCHAR(100) NULL,
  `branchId` INT NULL,
  `responsibleEmployeeId` INT NULL,
  `responsibleEmployerId` INT NULL,
  `responsibleName` VARCHAR(200) NULL,
  `status` VARCHAR(50) DEFAULT 'active',
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_vehicles_code` (`code`),
  UNIQUE KEY `UQ_vehicles_plateNumber` (`plateNumber`),
  KEY `FK_vehicles_branch` (`branchId`),
  CONSTRAINT `FK_vehicles_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phones` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NULL,
  `phoneNumber` VARCHAR(20) NULL,
  `provider` VARCHAR(50) DEFAULT 'etisalat',
  `category` VARCHAR(50) DEFAULT 'postpaid',
  `numberType` VARCHAR(50) DEFAULT 'mobile',
  `billAmount` DECIMAL(10,2) NULL,
  `legalEntityId` INT NULL,
  `registeredName` VARCHAR(200) NULL,
  `assignedBranchId` INT NULL,
  `assignedEmployeeId` INT NULL,
  `assignedHousingId` INT NULL,
  `assignedEmployerId` INT NULL,
  `status` VARCHAR(20) DEFAULT 'active',
  `note` TEXT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_phones_code` (`code`),
  KEY `FK_phones_branch` (`assignedBranchId`),
  KEY `FK_phones_employee` (`assignedEmployeeId`),
  KEY `FK_phones_employer` (`assignedEmployerId`),
  CONSTRAINT `FK_phones_branch` FOREIGN KEY (`assignedBranchId`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_phones_employee` FOREIGN KEY (`assignedEmployeeId`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_phones_employer` FOREIGN KEY (`assignedEmployerId`) REFERENCES `employers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `employers` ADD KEY `FK_employers_primaryPhone` (`primaryPhoneId`), ADD CONSTRAINT `FK_employers_primaryPhone` FOREIGN KEY (`primaryPhoneId`) REFERENCES `phones` (`id`) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Housing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `housing_units` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NULL,
  `name` VARCHAR(200) NOT NULL,
  `housingType` VARCHAR(20) DEFAULT 'labour',
  `emirate` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `landlordName` VARCHAR(200) NULL,
  `tenantDisplayName` VARCHAR(200) NULL,
  `contractNo` VARCHAR(100) NULL,
  `contractIssue` DATE NULL,
  `contractExpiry` DATE NULL,
  `rentAmount` DECIMAL(10,2) NULL,
  `paymentMethod` VARCHAR(50) NULL,
  `installmentsCount` INT DEFAULT 1,
  `ownedBy` VARCHAR(20) DEFAULT 'company',
  `branchId` INT NULL,
  `employeeId` INT NULL,
  `employerId` INT NULL,
  `status` VARCHAR(20) DEFAULT 'active',
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_housing_units_code` (`code`),
  KEY `FK_housing_units_branch` (`branchId`),
  KEY `FK_housing_units_employee` (`employeeId`),
  KEY `FK_housing_units_employer` (`employerId`),
  CONSTRAINT `FK_housing_units_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_housing_units_employee` FOREIGN KEY (`employeeId`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_housing_units_employer` FOREIGN KEY (`employerId`) REFERENCES `employers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `housing_installments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `housingId` INT NOT NULL,
  `seq` INT NOT NULL,
  `dueDate` DATE NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `paid` TINYINT(1) DEFAULT 0,
  `paidAt` DATETIME NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_housing_installments_housing` (`housingId`),
  CONSTRAINT `FK_housing_installments_housing` FOREIGN KEY (`housingId`) REFERENCES `housing_units` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `housing_occupants` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `housingUnitId` INT NOT NULL,
  `employeeId` INT NULL,
  `employerId` INT NULL,
  `name` VARCHAR(200) NULL,
  `role` VARCHAR(100) NULL,
  `fromDate` DATE NULL,
  `toDate` DATE NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_housing_occupants_unit` (`housingUnitId`),
  KEY `FK_housing_occupants_employee` (`employeeId`),
  KEY `FK_housing_occupants_employer` (`employerId`),
  CONSTRAINT `FK_housing_occupants_unit` FOREIGN KEY (`housingUnitId`) REFERENCES `housing_units` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_housing_occupants_employee` FOREIGN KEY (`employeeId`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_housing_occupants_employer` FOREIGN KEY (`employerId`) REFERENCES `employers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `housing_custom_fields` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `housingUnitId` INT NOT NULL,
  `title` VARCHAR(200) NULL,
  `content` TEXT NULL,
  `enableAlert` TINYINT(1) DEFAULT 0,
  `alertDate` DATE NULL,
  `daysBeforeExpiry` INT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_housing_custom_fields_unit` (`housingUnitId`),
  CONSTRAINT `FK_housing_custom_fields_unit` FOREIGN KEY (`housingUnitId`) REFERENCES `housing_units` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Branch licenses, leases, establishments, custom fields
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `branch_licenses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `licenseNo` VARCHAR(100) NOT NULL,
  `tradeName` VARCHAR(200) NOT NULL,
  `tradeNameEn` VARCHAR(200) NULL,
  `issueDate` DATE NULL,
  `expiryDate` DATE NULL,
  `renewalFee` DECIMAL(10,2) NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_branch_licenses_branch` (`branchId`),
  CONSTRAINT `FK_branch_licenses_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `branch_leases` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `contractNo` VARCHAR(100) NULL,
  `landlordName` VARCHAR(200) NULL,
  `amount` DECIMAL(10,2) NULL,
  `issueDate` DATE NULL,
  `expiryDate` DATE NULL,
  `paymentMethod` VARCHAR(50) NULL,
  `installmentsCount` INT DEFAULT 1,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_branch_leases_branch` (`branchId`),
  CONSTRAINT `FK_branch_leases_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lease_installments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `leaseId` INT NOT NULL,
  `seq` INT NOT NULL,
  `dueDate` DATE NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `paid` TINYINT(1) DEFAULT 0,
  `paidAt` DATETIME NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_lease_installments_lease` (`leaseId`),
  CONSTRAINT `FK_lease_installments_lease` FOREIGN KEY (`leaseId`) REFERENCES `branch_leases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `branch_establishments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `isEnabled` TINYINT(1) DEFAULT 0,
  `laborEstablishmentCardNo` VARCHAR(100) NULL,
  `immigrationEstablishmentCardNo` VARCHAR(100) NULL,
  `immigrationCardIssueDate` DATE NULL,
  `immigrationCardExpiryDate` DATE NULL,
  `trn` VARCHAR(15) NULL,
  `corporateTaxRegistration` VARCHAR(50) NULL,
  `mohreEstNo` VARCHAR(100) NULL,
  `gdrfaEstNo` VARCHAR(100) NULL,
  `gdrfaIssueDate` DATE NULL,
  `gdrfaExpiryDate` DATE NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_branch_establishments_branchId` (`branchId`),
  CONSTRAINT `FK_branch_establishments_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `branch_custom_fields` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NULL,
  `enableAlert` TINYINT(1) DEFAULT 0,
  `alertDate` DATE NULL,
  `daysBeforeExpiry` INT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_branch_custom_fields_branch` (`branchId`),
  CONSTRAINT `FK_branch_custom_fields_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vehicle_custom_fields` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vehicleId` INT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NULL,
  `enableAlert` TINYINT(1) DEFAULT 0,
  `alertDate` DATE NULL,
  `daysBeforeExpiry` INT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_vehicle_custom_fields_vehicle` (`vehicleId`),
  CONSTRAINT `FK_vehicle_custom_fields_vehicle` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Notifications, Tax, Settings, Documents, Logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entityType` VARCHAR(50) NOT NULL,
  `entityId` INT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NULL,
  `dueDate` DATE NULL,
  `severity` VARCHAR(20) DEFAULT 'warning',
  `isRead` TINYINT(1) DEFAULT 0,
  `readAt` DATETIME NULL,
  `isArchived` TINYINT(1) DEFAULT 0,
  `relatedField` VARCHAR(100) NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IX_notifications_entity` (`entityType`, `entityId`),
  KEY `IX_notifications_dueDate` (`dueDate`),
  KEY `IX_notifications_isRead` (`isRead`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tax_entity_branches` (
  `entityId` INT NOT NULL,
  `branchId` INT NOT NULL,
  PRIMARY KEY (`entityId`, `branchId`),
  KEY `FK_tax_entity_branches_entity` (`entityId`),
  KEY `FK_tax_entity_branches_branch` (`branchId`),
  CONSTRAINT `FK_tax_entity_branches_entity` FOREIGN KEY (`entityId`) REFERENCES `entities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_tax_entity_branches_branch` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(200) NOT NULL,
  `value` TEXT NULL,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_settings_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tax_payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entityId` INT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `financialYear` INT NOT NULL,
  `quarter` INT NULL,
  `periodFrom` VARCHAR(50) NULL,
  `periodTo` VARCHAR(50) NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `paymentDate` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_tax_payments_entity` (`entityId`),
  CONSTRAINT `FK_tax_payments_entity` FOREIGN KEY (`entityId`) REFERENCES `entities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `documents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `relativePath` VARCHAR(500) NOT NULL,
  `customName` VARCHAR(200) NULL,
  `originalFileName` VARCHAR(255) NULL,
  `entityType` VARCHAR(50) NOT NULL,
  `entityId` INT NULL,
  `section` VARCHAR(100) NULL,
  `mimeType` VARCHAR(150) NULL,
  `sizeBytes` BIGINT NULL,
  `uploadedByUserId` INT NULL,
  `isArchived` TINYINT(1) DEFAULT 0,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IX_documents_entity_lookup` (`entityType`, `entityId`, `section`, `isArchived`),
  KEY `IX_documents_createdAt` (`createdAt`),
  KEY `FK_documents_uploadedBy` (`uploadedByUserId`),
  CONSTRAINT `FK_documents_uploadedBy` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `module` VARCHAR(100) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entityType` VARCHAR(100) NOT NULL,
  `entityId` INT NULL,
  `details` TEXT NULL,
  `performedByUserId` INT NULL,
  `performedByUsername` VARCHAR(200) NULL,
  `performedByUserCode` VARCHAR(20) NULL,
  PRIMARY KEY (`id`),
  KEY `IX_activity_logs_entity_created` (`entityType`, `entityId`, `createdAt`),
  KEY `IX_activity_logs_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `employee_status_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `employeeId` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `startDate` VARCHAR(50) NOT NULL,
  `endDate` VARCHAR(50) NULL,
  `durationDays` INT NULL,
  `performedByUserId` INT NULL,
  `performedByUsername` VARCHAR(200) NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_employee_status_history_employee` (`employeeId`),
  CONSTRAINT `FK_employee_status_history_employee` FOREIGN KEY (`employeeId`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `status_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entityType` VARCHAR(100) NOT NULL,
  `entityId` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `startDate` VARCHAR(50) NOT NULL,
  `endDate` VARCHAR(50) NULL,
  `durationDays` INT NULL,
  `performedByUserId` INT NULL,
  `performedByUsername` VARCHAR(200) NULL,
  `performedByUserCode` VARCHAR(20) NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IX_status_history_entity_start` (`entityType`, `entityId`, `startDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Seed: roles (Admin + User only), permissions v4 catalog, admin user
-- ---------------------------------------------------------------------------

-- Only two roles: Admin (full access in code) and User (explicit grants only)
INSERT INTO `roles` (`id`, `name`, `description`, `isSystem`) VALUES
  (1, 'Admin', 'مدير النظام — صلاحية كاملة تلقائياً', 1),
  (2, 'User', 'مستخدم — يحتاج صلاحيات صريحة', 1)
ON DUPLICATE KEY UPDATE `description`=VALUES(`description`);

-- Permission catalog v4 — granular: section.visible, view/create/edit/delete, tab.*, field.*, action.*
-- No 'manage' wildcard. Each permission is an explicit key.
INSERT INTO `permissions` (`module`, `action`, `labelKey`) VALUES
  -- ═══ Employees ═══
  ('employees', 'section.visible', 'employees.section.visible'),
  ('employees', 'view', 'employees.view'),
  ('employees', 'create', 'employees.create'),
  ('employees', 'edit', 'employees.edit'),
  ('employees', 'delete', 'employees.delete'),
  ('employees', 'archive', 'employees.archive'),
  ('employees', 'tab.basic', 'employees.tab.basic'),
  ('employees', 'tab.passport', 'employees.tab.passport'),
  ('employees', 'tab.contract', 'employees.tab.contract'),
  ('employees', 'tab.residency', 'employees.tab.residency'),
  ('employees', 'tab.insurances', 'employees.tab.insurances'),
  ('employees', 'tab.workStatus', 'employees.tab.workStatus'),
  ('employees', 'tab.phones', 'employees.tab.phones'),
  ('employees', 'tab.history', 'employees.tab.history'),
  ('employees', 'tab.documents', 'employees.tab.documents'),
  ('employees', 'field.nationality', 'employees.field.nationality'),
  ('employees', 'field.email', 'employees.field.email'),
  ('employees', 'field.phone', 'employees.field.phone'),
  ('employees', 'field.profilePhoto', 'employees.field.profilePhoto'),
  ('employees', 'field.passportNo', 'employees.field.passportNo'),
  ('employees', 'field.passportExpiry', 'employees.field.passportExpiry'),
  ('employees', 'field.nationalId', 'employees.field.nationalId'),
  ('employees', 'field.emiratesIdExpiry', 'employees.field.emiratesIdExpiry'),
  ('employees', 'field.salary', 'employees.field.salary'),
  ('employees', 'field.actualSalary', 'employees.field.actualSalary'),
  ('employees', 'field.contractDetails', 'employees.field.contractDetails'),
  ('employees', 'field.contractAllowances', 'employees.field.contractAllowances'),
  ('employees', 'field.insuranceHealth', 'employees.field.insuranceHealth'),
  ('employees', 'field.insuranceUnemployment', 'employees.field.insuranceUnemployment'),
  ('employees', 'field.workBranch', 'employees.field.workBranch'),
  ('employees', 'field.profession', 'employees.field.profession'),
  ('employees', 'field.loanDetails', 'employees.field.loanDetails'),
  ('employees', 'field.documentsLegal', 'employees.field.documentsLegal'),
  ('employees', 'field.documentsFinancial', 'employees.field.documentsFinancial'),
  ('employees', 'action.changeStatus', 'employees.action.changeStatus'),
  ('employees', 'action.transferBranch', 'employees.action.transferBranch'),
  ('employees', 'action.uploadDocs', 'employees.action.uploadDocs'),
  ('employees', 'action.deleteDocs', 'employees.action.deleteDocs'),
  ('employees', 'action.exportData', 'employees.action.exportData'),
  -- ═══ Branches ═══
  ('branches', 'section.visible', 'branches.section.visible'),
  ('branches', 'view', 'branches.view'),
  ('branches', 'create', 'branches.create'),
  ('branches', 'edit', 'branches.edit'),
  ('branches', 'delete', 'branches.delete'),
  ('branches', 'tab.basic', 'branches.tab.basic'),
  ('branches', 'tab.licenses', 'branches.tab.licenses'),
  ('branches', 'tab.entity', 'branches.tab.entity'),
  ('branches', 'tab.employees', 'branches.tab.employees'),
  ('branches', 'tab.employers', 'branches.tab.employers'),
  ('branches', 'tab.history', 'branches.tab.history'),
  ('branches', 'tab.documents', 'branches.tab.documents'),
  ('branches', 'tab.phones', 'branches.tab.phones'),
  ('branches', 'field.branchType', 'branches.field.branchType'),
  ('branches', 'field.location', 'branches.field.location'),
  ('branches', 'field.contact', 'branches.field.contact'),
  ('branches', 'field.photo', 'branches.field.photo'),
  ('branches', 'field.address', 'branches.field.address'),
  ('branches', 'field.mapLink', 'branches.field.mapLink'),
  ('branches', 'field.workSchedule', 'branches.field.workSchedule'),
  ('branches', 'field.linkedBranch', 'branches.field.linkedBranch'),
  ('branches', 'field.tradeLicense', 'branches.field.tradeLicense'),
  ('branches', 'field.leaseContract', 'branches.field.leaseContract'),
  ('branches', 'field.leaseAmount', 'branches.field.leaseAmount'),
  ('branches', 'field.leaseSchedule', 'branches.field.leaseSchedule'),
  ('branches', 'field.taxIdentifiers', 'branches.field.taxIdentifiers'),
  ('branches', 'field.entityInfo', 'branches.field.entityInfo'),
  ('branches', 'field.employeeList', 'branches.field.employeeList'),
  ('branches', 'field.salaryInEmployeeTab', 'branches.field.salaryInEmployeeTab'),
  ('branches', 'field.employerList', 'branches.field.employerList'),
  ('branches', 'field.employerOwnership', 'branches.field.employerOwnership'),
  ('branches', 'action.uploadDocs', 'branches.action.uploadDocs'),
  ('branches', 'action.deleteDocs', 'branches.action.deleteDocs'),
  -- ═══ Housing ═══
  ('housing', 'section.visible', 'housing.section.visible'),
  ('housing', 'view', 'housing.view'),
  ('housing', 'create', 'housing.create'),
  ('housing', 'edit', 'housing.edit'),
  ('housing', 'delete', 'housing.delete'),
  ('housing', 'tab.basic', 'housing.tab.basic'),
  ('housing', 'tab.contract', 'housing.tab.contract'),
  ('housing', 'tab.occupants', 'housing.tab.occupants'),
  ('housing', 'tab.phones', 'housing.tab.phones'),
  ('housing', 'tab.history', 'housing.tab.history'),
  ('housing', 'tab.documents', 'housing.tab.documents'),
  ('housing', 'field.contractAmount', 'housing.field.contractAmount'),
  ('housing', 'field.installments', 'housing.field.installments'),
  ('housing', 'field.occupantsList', 'housing.field.occupantsList'),
  ('housing', 'action.uploadDocs', 'housing.action.uploadDocs'),
  ('housing', 'action.deleteDocs', 'housing.action.deleteDocs'),
  -- ═══ Vehicles ═══
  ('vehicles', 'section.visible', 'vehicles.section.visible'),
  ('vehicles', 'view', 'vehicles.view'),
  ('vehicles', 'create', 'vehicles.create'),
  ('vehicles', 'edit', 'vehicles.edit'),
  ('vehicles', 'delete', 'vehicles.delete'),
  ('vehicles', 'tab.basic', 'vehicles.tab.basic'),
  ('vehicles', 'tab.licenses', 'vehicles.tab.licenses'),
  ('vehicles', 'tab.permits', 'vehicles.tab.permits'),
  ('vehicles', 'tab.history', 'vehicles.tab.history'),
  ('vehicles', 'tab.documents', 'vehicles.tab.documents'),
  ('vehicles', 'field.insuranceDetails', 'vehicles.field.insuranceDetails'),
  ('vehicles', 'field.licenseDetails', 'vehicles.field.licenseDetails'),
  ('vehicles', 'field.permitDetails', 'vehicles.field.permitDetails'),
  ('vehicles', 'action.uploadDocs', 'vehicles.action.uploadDocs'),
  ('vehicles', 'action.deleteDocs', 'vehicles.action.deleteDocs'),
  -- ═══ Employers ═══
  ('employers', 'section.visible', 'employers.section.visible'),
  ('employers', 'view', 'employers.view'),
  ('employers', 'create', 'employers.create'),
  ('employers', 'edit', 'employers.edit'),
  ('employers', 'delete', 'employers.delete'),
  ('employers', 'tab.basic', 'employers.tab.basic'),
  ('employers', 'tab.passportResidency', 'employers.tab.passportResidency'),
  ('employers', 'tab.branches', 'employers.tab.branches'),
  ('employers', 'tab.docs', 'employers.tab.docs'),
  ('employers', 'tab.history', 'employers.tab.history'),
  ('employers', 'field.passportDetails', 'employers.field.passportDetails'),
  ('employers', 'field.emiratesId', 'employers.field.emiratesId'),
  ('employers', 'field.branchLinks', 'employers.field.branchLinks'),
  ('employers', 'field.ownershipPercent', 'employers.field.ownershipPercent'),
  ('employers', 'action.uploadDocs', 'employers.action.uploadDocs'),
  ('employers', 'action.deleteDocs', 'employers.action.deleteDocs'),
  -- ═══ Phones ═══
  ('phones', 'section.visible', 'phones.section.visible'),
  ('phones', 'view', 'phones.view'),
  ('phones', 'create', 'phones.create'),
  ('phones', 'edit', 'phones.edit'),
  ('phones', 'delete', 'phones.delete'),
  ('phones', 'tab.basic', 'phones.tab.basic'),
  ('phones', 'tab.history', 'phones.tab.history'),
  ('phones', 'tab.documents', 'phones.tab.documents'),
  ('phones', 'field.simDetails', 'phones.field.simDetails'),
  ('phones', 'field.assignedTo', 'phones.field.assignedTo'),
  ('phones', 'action.uploadDocs', 'phones.action.uploadDocs'),
  ('phones', 'action.deleteDocs', 'phones.action.deleteDocs'),
  -- ═══ Entities (Tax) ═══
  ('entities', 'section.visible', 'entities.section.visible'),
  ('entities', 'view', 'entities.view'),
  ('entities', 'create', 'entities.create'),
  ('entities', 'edit', 'entities.edit'),
  ('entities', 'delete', 'entities.delete'),
  ('entities', 'tab.main', 'entities.tab.main'),
  ('entities', 'tab.branches', 'entities.tab.branches'),
  ('entities', 'tab.vat', 'entities.tab.vat'),
  ('entities', 'tab.corporate', 'entities.tab.corporate'),
  ('entities', 'tab.summary', 'entities.tab.summary'),
  ('entities', 'tab.documents', 'entities.tab.documents'),
  ('entities', 'tab.history', 'entities.tab.history'),
  ('entities', 'field.financialYear', 'entities.field.financialYear'),
  ('entities', 'field.taxPayments', 'entities.field.taxPayments'),
  ('entities', 'field.taxSummary', 'entities.field.taxSummary'),
  ('entities', 'action.uploadDocs', 'entities.action.uploadDocs'),
  ('entities', 'action.deleteDocs', 'entities.action.deleteDocs'),
  -- ═══ Documents ═══
  ('documents', 'section.visible', 'documents.section.visible'),
  ('documents', 'view', 'documents.view'),
  ('documents', 'create', 'documents.create'),
  ('documents', 'edit', 'documents.edit'),
  ('documents', 'delete', 'documents.delete'),
  -- ═══ Settings ═══
  ('settings', 'section.visible', 'settings.section.visible'),
  ('settings', 'view', 'settings.view'),
  ('settings', 'edit', 'settings.edit'),
  ('settings', 'sub.general', 'settings.sub.general'),
  ('settings', 'sub.language', 'settings.sub.language'),
  ('settings', 'sub.users', 'settings.sub.users'),
  ('settings', 'sub.permissions', 'settings.sub.permissions'),
  ('settings', 'sub.notifications', 'settings.sub.notifications'),
  ('settings', 'sub.database', 'settings.sub.database'),
  ('settings', 'sub.devices', 'settings.sub.devices'),
  ('settings', 'sub.backup', 'settings.sub.backup'),
  ('settings', 'users.view', 'settings.users.view'),
  ('settings', 'users.create', 'settings.users.create'),
  ('settings', 'users.edit', 'settings.users.edit'),
  ('settings', 'users.delete', 'settings.users.delete'),
  -- ═══ Logs ═══
  ('logs', 'section.visible', 'logs.section.visible'),
  ('logs', 'view', 'logs.view')
ON DUPLICATE KEY UPDATE labelKey=VALUES(labelKey);

-- NOTE: No role_permissions INSERT needed.
-- Admin (roleId=1) gets ALL permissions automatically in code.
-- User permissions are managed via user_permissions table only.

-- Default admin user: username=admin, password=admin123 (bcrypt 10 rounds)
-- Change password after first login in production
INSERT INTO `users` (`username`, `passwordHash`, `fullName`, `email`, `roleId`, `isActive`, `createdAt`, `updatedAt`)
VALUES ('admin', '$2a$10$FNHrlBrT/JCh0Il0K2q61Onvr.8KTmo8peRF3z7.RkUQ72FAxGWb6', 'مدير النظام', 'admin@alredaa.com', 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE username=username;

