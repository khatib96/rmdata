-- RMDATA SQLite to MySQL data export
-- Generated: 2026-03-25T20:49:36.647Z
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
SET NAMES utf8mb4;
SET CHARACTER SET 'utf8mb4';
SET collation_connection = 'utf8mb4_unicode_ci';
SET FOREIGN_KEY_CHECKS = 0;

-- Table: activity_logs
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `createdAt` LONGTEXT DEFAULT CURRENT_TIMESTAMP,
  `module` LONGTEXT NOT NULL,
  `action` LONGTEXT NOT NULL,
  `entityType` LONGTEXT NOT NULL,
  `entityId` INT,
  `details` LONGTEXT,
  `performedByUserId` INT,
  `performedByUsername` LONGTEXT,
  `performedByUserCode` VARCHAR(20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: branch_leases
DROP TABLE IF EXISTS `branch_leases`;
CREATE TABLE `branch_leases` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `contractNo` varchar(100),
  `landlordName` varchar(200),
  `amount` TEXT,
  `issueDate` DATETIME,
  `expiryDate` DATETIME,
  `paymentMethod` varchar(50),
  `installmentsCount` INT NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: branch_licenses
DROP TABLE IF EXISTS `branch_licenses`;
CREATE TABLE `branch_licenses` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `licenseNo` varchar(100) NOT NULL,
  `tradeName` varchar(200) NOT NULL,
  `issueDate` DATETIME,
  `expiryDate` DATETIME,
  `renewalFee` TEXT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tradeNameEn` varchar(200)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: branches
DROP TABLE IF EXISTS `branches`;
CREATE TABLE `branches` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `nameEn` varchar(200),
  `phone` varchar(20),
  `emirate` varchar(50) NOT NULL,
  `address` LONGTEXT,
  `branchType` varchar(255) NOT NULL DEFAULT 'store',
  `isAttached` TINYINT(1) NOT NULL DEFAULT 0,
  `attachedToId` INT,
  `photoPath` varchar(255),
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `country` varchar(100) NOT NULL DEFAULT 'United Arab Emirates',
  `tradeLicenseNo` varchar(100),
  `tradeLicenseExpiry` DATETIME,
  `establishmentCardNo` varchar(100),
  `establishmentCardExpiry` DATETIME,
  `workHours` varchar(20),
  `workTimingSlots` LONGTEXT,
  `city` varchar(100),
  `code` varchar(20),
  `googleMapUrl` LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: documents
DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `relativePath` LONGTEXT NOT NULL,
  `customName` LONGTEXT,
  `entityType` LONGTEXT NOT NULL,
  `entityId` INT,
  `section` LONGTEXT,
  `createdAt` LONGTEXT DEFAULT CURRENT_TIMESTAMP,
  `isArchived` INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: employee_status_history
DROP TABLE IF EXISTS `employee_status_history`;
CREATE TABLE `employee_status_history` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `employeeId` INT NOT NULL,
  `status` LONGTEXT NOT NULL,
  `startDate` LONGTEXT NOT NULL,
  `endDate` LONGTEXT,
  `durationDays` INT,
  `performedByUserId` INT,
  `performedByUsername` LONGTEXT,
  `createdAt` LONGTEXT DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: employees
DROP TABLE IF EXISTS `employees`;
CREATE TABLE `employees` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `imagePath` varchar(255),
  `name` varchar(200) NOT NULL,
  `phone` varchar(20),
  `email` varchar(100),
  `nationality` varchar(50),
  `passportNumber` varchar(50),
  `passportExpiry` DATETIME,
  `passportCountry` varchar(50),
  `profession` varchar(100),
  `contractType` varchar(255),
  `contractStartDate` DATETIME,
  `contractExpiryDate` DATETIME,
  `workLicense` varchar(50),
  `workCardNumber` varchar(50),
  `workCardExpiry` DATETIME,
  `workBranchId` INT,
  `legalEntityId` INT,
  `establishmentId` INT,
  `emiratesId` varchar(50),
  `emiratesIdExpiry` DATETIME,
  `basicSalary` TEXT,
  `housingAllowance` TEXT,
  `transportAllowance` TEXT,
  `otherAllowances` TEXT,
  `totalSalary` TEXT,
  `actualSalary` TEXT,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `notes` LONGTEXT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `passportIssueDate` DATETIME,
  `issueEmirate` varchar(50),
  `employerName` varchar(200),
  `establishmentNumber` varchar(100),
  `loanType` varchar(20),
  `targetEntityName` varchar(200),
  `loanExpiryDate` DATETIME,
  `tempContractNumber` varchar(50),
  `loanSalary` TEXT,
  `professionCustomTitle` varchar(200),
  `professionKeys` LONGTEXT,
  `healthInsuranceEnabled` INT DEFAULT 0,
  `healthInsuranceProvider` varchar(200),
  `healthInsuranceIssueDate` DATETIME,
  `healthInsuranceExpiryDate` DATETIME,
  `unemploymentInsuranceEnabled` INT DEFAULT 0,
  `unemploymentInsuranceProvider` varchar(200),
  `unemploymentInsuranceIssueDate` DATETIME,
  `unemploymentInsuranceExpiryDate` DATETIME,
  `professionPerContract` varchar(200),
  `loanBranchId` INT,
  `loanProfession` varchar(200),
  `loanSubStatus` varchar(20),
  `immigrationEstablishmentNumber` varchar(100),
  `emiratesIdIssueDate` DATETIME,
  `contractBranchId` INT,
  `code` varchar(20),
  `loanLeaveStartDate` DATETIME,
  `loanLeaveEndDate` DATETIME,
  `userId` INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: employers
DROP TABLE IF EXISTS `employers`;
CREATE TABLE `employers` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `code` varchar(20),
  `photoPath` varchar(255),
  `fullName` varchar(200) NOT NULL,
  `fullNameEn` varchar(200),
  `nationality` varchar(50),
  `phone` varchar(20),
  `email` varchar(100),
  `passportNumber` varchar(50),
  `passportIssueDate` DATETIME,
  `passportExpiry` DATETIME,
  `passportCountry` varchar(50),
  `emiratesId` varchar(50),
  `emiratesIdIssueDate` DATETIME,
  `emiratesIdExpiry` DATETIME,
  `occupation` varchar(200),
  `notes` LONGTEXT,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `issueEmirate` varchar(50),
  `primaryPhoneId` INT,
  `userId` INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: entities
DROP TABLE IF EXISTS `entities`;
CREATE TABLE `entities` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `nameEn` varchar(200),
  `tradeLicenseNumber` varchar(50),
  `tradeLicenseExpiry` DATETIME,
  `vatTrn` varchar(50),
  `vatRegDate` DATETIME,
  `corporateTaxTrn` varchar(50),
  `corporateTaxRegDate` DATETIME,
  `mainBranchId` INT,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `notes` LONGTEXT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `trn` varchar(15),
  `corporateTaxGiban` varchar(50),
  `vatFilingCycle` varchar(20),
  `entityNickname` varchar(200),
  `registeredAddress` LONGTEXT,
  `contactNumber` varchar(50),
  `financialYearEnd` varchar(20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: housing_custom_fields
DROP TABLE IF EXISTS `housing_custom_fields`;
CREATE TABLE `housing_custom_fields` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `housingUnitId` INT NOT NULL,
  `title` VARCHAR(200),
  `content` LONGTEXT,
  `enableAlert` INT DEFAULT 0,
  `alertDate` DATETIME,
  `daysBeforeExpiry` INT,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: housing_installments
DROP TABLE IF EXISTS `housing_installments`;
CREATE TABLE `housing_installments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `housingId` INT NOT NULL,
  `seq` INT NOT NULL,
  `dueDate` DATETIME,
  `amount` TEXT NOT NULL,
  `paid` TINYINT(1) NOT NULL DEFAULT 0,
  `paidAt` DATETIME,
  `note` LONGTEXT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: housing_occupants
DROP TABLE IF EXISTS `housing_occupants`;
CREATE TABLE `housing_occupants` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `housingUnitId` INT NOT NULL,
  `employeeId` INT,
  `name` varchar(200),
  `role` varchar(100),
  `fromDate` DATETIME,
  `toDate` DATETIME,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `employerId` INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: housing_units
DROP TABLE IF EXISTS `housing_units`;
CREATE TABLE `housing_units` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `housingType` varchar(255) NOT NULL DEFAULT 'labour',
  `emirate` varchar(50),
  `contractNo` varchar(100),
  `contractIssue` DATETIME,
  `contractExpiry` DATETIME,
  `rentAmount` TEXT,
  `paymentMethod` varchar(50),
  `installmentsCount` INT NOT NULL DEFAULT 1,
  `ownedBy` varchar(255) NOT NULL DEFAULT 'company',
  `branchId` INT,
  `employeeId` INT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `code` varchar(20),
  `address` LONGTEXT,
  `landlordName` varchar(200),
  `tenantDisplayName` varchar(200),
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `employerId` INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: lease_installments
DROP TABLE IF EXISTS `lease_installments`;
CREATE TABLE `lease_installments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `leaseId` INT NOT NULL,
  `seq` INT NOT NULL,
  `dueDate` DATETIME,
  `amount` TEXT NOT NULL,
  `paid` TINYINT(1) NOT NULL DEFAULT 0,
  `paidAt` DATETIME,
  `note` LONGTEXT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: notifications
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `entityType` varchar(50) NOT NULL,
  `entityId` INT NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` LONGTEXT,
  `dueDate` DATETIME,
  `severity` varchar(255) NOT NULL DEFAULT 'warning',
  `isRead` TINYINT(1) NOT NULL DEFAULT 0,
  `relatedField` varchar(100),
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `isArchived` TINYINT(1) NOT NULL DEFAULT 0,
  `readAt` DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: permissions
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `module` LONGTEXT NOT NULL,
  `action` LONGTEXT NOT NULL,
  `labelKey` LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: phones
DROP TABLE IF EXISTS `phones`;
CREATE TABLE `phones` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `assignedBranchId` INT,
  `assignedEmployeeId` INT,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `note` LONGTEXT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `phoneNumber` varchar(20),
  `provider` varchar(255) NOT NULL DEFAULT 'etisalat',
  `category` varchar(255) NOT NULL DEFAULT 'postpaid',
  `numberType` varchar(255) NOT NULL DEFAULT 'mobile',
  `billAmount` TEXT,
  `legalEntityId` INT,
  `registeredName` varchar(200),
  `assignedHousingId` INT,
  `assignedEmployerId` INT,
  `code` VARCHAR(20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: role_permissions
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `roleId` INT NOT NULL,
  `permissionId` INT NOT NULL,
  PRIMARY KEY (`roleId`, `permissionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: roles
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` LONGTEXT NOT NULL,
  `description` LONGTEXT,
  `isSystem` INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: settings
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `key` LONGTEXT NOT NULL,
  `value` LONGTEXT,
  `updatedAt` LONGTEXT DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: status_history
DROP TABLE IF EXISTS `status_history`;
CREATE TABLE `status_history` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `entityType` LONGTEXT NOT NULL,
  `entityId` INT NOT NULL,
  `status` LONGTEXT NOT NULL,
  `startDate` LONGTEXT NOT NULL,
  `endDate` LONGTEXT,
  `durationDays` INT,
  `performedByUserId` INT,
  `performedByUsername` LONGTEXT,
  `createdAt` LONGTEXT DEFAULT CURRENT_TIMESTAMP,
  `performedByUserCode` VARCHAR(20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: tax_entity_branches
DROP TABLE IF EXISTS `tax_entity_branches`;
CREATE TABLE `tax_entity_branches` (
  `entityId` INT NOT NULL,
  `branchId` INT NOT NULL,
  PRIMARY KEY (`entityId`, `branchId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: tax_payments
DROP TABLE IF EXISTS `tax_payments`;
CREATE TABLE `tax_payments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `entityId` INT NOT NULL,
  `type` LONGTEXT NOT NULL,
  `financialYear` INT NOT NULL,
  `quarter` INT,
  `periodFrom` LONGTEXT,
  `periodTo` LONGTEXT,
  `amount` DOUBLE NOT NULL,
  `paymentDate` LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: user_permissions
DROP TABLE IF EXISTS `user_permissions`;
CREATE TABLE `user_permissions` (
  `userId` INT NOT NULL,
  `permissionId` INT NOT NULL,
  PRIMARY KEY (`userId`, `permissionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: users
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `fullName` varchar(100) NOT NULL,
  `email` varchar(255),
  `roleId` INT NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `lastLoginAt` varchar(255),
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `userType` varchar(20) NOT NULL DEFAULT 'free',
  `linkedEntityType` varchar(50),
  `linkedEntityId` INT,
  `mustChangePassword` TINYINT(1) NOT NULL DEFAULT 0,
  `passwordChangedAt` varchar(255),
  `role` varchar(255) NOT NULL DEFAULT 'Employee',
  `branchId` INT,
  `entityId` INT,
  `avatarPath` LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: vehicle_custom_fields
DROP TABLE IF EXISTS `vehicle_custom_fields`;
CREATE TABLE `vehicle_custom_fields` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `vehicleId` INT NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` LONGTEXT,
  `enableAlert` TINYINT(1) NOT NULL DEFAULT 0,
  `alertDate` DATETIME,
  `daysBeforeExpiry` INT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: vehicles
DROP TABLE IF EXISTS `vehicles`;
CREATE TABLE `vehicles` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `model` varchar(100),
  `year` INT,
  `insuranceType` varchar(50),
  `insuranceCompany` varchar(200),
  `insuranceExpiryDate` DATETIME,
  `plateNumber` varchar(50) NOT NULL,
  `branchId` INT,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `code` varchar(20),
  `photoPath` varchar(255),
  `brand` varchar(100),
  `vehicleType` varchar(20),
  `ownershipType` varchar(20),
  `ownerName` varchar(200),
  `issuePlace` varchar(100),
  `trafficNo` varchar(100),
  `chassisNo` varchar(100),
  `engineNo` varchar(100),
  `licenseRegDate` DATETIME,
  `licenseExpiryDate` DATETIME,
  `insurancePolicyNo` varchar(100),
  `responsibleEmployeeId` INT,
  `responsibleName` varchar(200),
  `plateCode` varchar(20),
  `vehicleName` varchar(200),
  `responsibleEmployerId` INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: branch_custom_fields
DROP TABLE IF EXISTS `branch_custom_fields`;
CREATE TABLE `branch_custom_fields` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` LONGTEXT,
  `enableAlert` TINYINT(1) NOT NULL DEFAULT 0,
  `alertDate` DATETIME,
  `daysBeforeExpiry` INT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: branch_employers
DROP TABLE IF EXISTS `branch_employers`;
CREATE TABLE `branch_employers` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `employerId` INT NOT NULL,
  `role` varchar(30) NOT NULL DEFAULT 'owner',
  `ownershipPercent` TEXT,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: branch_establishments
DROP TABLE IF EXISTS `branch_establishments`;
CREATE TABLE `branch_establishments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `branchId` INT NOT NULL,
  `isEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `mohreEstNo` varchar(100),
  `gdrfaEstNo` varchar(100),
  `gdrfaIssueDate` DATETIME,
  `gdrfaExpiryDate` DATETIME,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `laborEstablishmentCardNo` varchar(100),
  `immigrationEstablishmentCardNo` varchar(100),
  `immigrationCardIssueDate` DATETIME,
  `immigrationCardExpiryDate` DATETIME,
  `trn` varchar(15),
  `corporateTaxRegistration` varchar(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `activity_logs` (`id`, `createdAt`, `module`, `action`, `entityType`, `entityId`, `details`, `performedByUserId`, `performedByUsername`, `performedByUserCode`) VALUES
(1, '2026-02-22 19:30:35', 'employee', 'status_change', 'employee', 3, 'تحديث حالة علي: إجازة → يعمل (2026-02-22)', 1, 'admin', NULL),
(2, '2026-02-22 19:32:11', 'branch', 'expiry_update', 'branch', 4, 'تحديث تاريخ انتهاء عقد الإيجار إلى 2026-02-01', 1, 'admin', NULL),
(3, '2026-02-22 19:32:35', 'branch', 'expiry_update', 'branch', 4, 'تحديث تاريخ انتهاء عقد الإيجار إلى 2027-02-01', 1, 'admin', NULL),
(4, '2026-02-22 19:39:20', 'employee', 'status_change', 'employee', 3, 'تحديث حالة علي: يعمل → إجازة (2026-02-21)', 1, 'admin', NULL),
(5, '2026-02-22 19:39:42', 'employee', 'status_change', 'employee', 3, 'تحديث حالة علي: إجازة → يعمل (2026-02-23)', 1, 'admin', NULL),
(6, '2026-02-22 20:38:11', 'employee', 'status_change', 'employee', 1, 'تحديث حالة محمد الخطيب: معار → معار (2026-02-22)', 1, 'admin', NULL),
(7, '2026-02-22 20:40:15', 'branch', 'expiry_update', 'branch', 1, 'تحديث تاريخ انتهاء بطاقة الهجرة إلى 2026-03-31', 1, 'admin', NULL),
(8, '2026-02-23 19:48:39', 'vehicle', 'assign_responsible', 'vehicle', 1, 'تعيين مسؤول المركبة: علي (80097)', 1, 'admin', NULL),
(9, '2026-02-23 19:48:55', 'vehicle', 'assign_responsible', 'vehicle', 1, 'تعيين مسؤول المركبة: علي (80097)', 1, 'admin', NULL),
(10, '2026-02-23 19:57:23', 'employee', 'edit', 'employee', 3, 'تم تغيير الوظيفة إلى "بائع، سائق"', 1, 'admin', NULL),
(11, '2026-02-23 19:57:36', 'vehicle', 'assign_responsible', 'vehicle', 1, 'تعيين مسؤول المركبة: علي (80097)', 1, 'admin', NULL),
(12, '2026-02-23 20:39:29', 'employee', 'edit', 'employee', 1, 'تم تغيير الوظيفة إلى "إداري"', 1, 'admin', NULL),
(13, '2026-02-23 20:58:20', 'employee', 'edit', 'employee', 1, 'تحديث تفاصيل عمل محمد الخطيب', 1, 'admin', NULL),
(14, '2026-02-23 20:58:44', 'employee', 'edit', 'employee', 1, 'تحديث تفاصيل عمل محمد الخطيب', 1, 'admin', NULL),
(15, '2026-02-23 21:16:53', 'archive', 'archive', 'branch', 5, 'تمت أرشفة فرع: موقع الرداء الموحد بواسطة Super Admin', 1, 'Super Admin', NULL),
(16, '2026-02-23 21:17:13', 'archive', 'restore', 'branch', 5, 'تمت استعادة فرع: موقع الرداء الموحد بواسطة Super Admin', 1, 'Super Admin', NULL),
(17, '2026-02-24 18:07:42', 'employee', 'edit', 'employee', 1, 'تحديث تفاصيل عمل محمد الخطيب', 1, 'admin', NULL),
(18, '2026-02-24 18:14:22', 'employee', 'edit', 'employee', 1, 'تم رفع الراتب إلى ٤٬٠٠٠ درهم', 1, 'admin', NULL),
(19, '2026-02-24 18:14:59', 'employee', 'edit', 'employee', 1, 'تم تغيير الوظيفة إلى "سائق"', 1, 'admin', NULL),
(20, '2026-02-24 18:15:18', 'employee', 'edit', 'employee', 1, 'تحديث تفاصيل عمل محمد الخطيب', 1, 'admin', NULL),
(21, '2026-02-24 19:03:39', 'employee', 'status_change', 'employee', 1, 'تحديث تفاصيل عمل محمد الخطيب', 1, 'admin', NULL),
(22, '2026-02-24 19:04:26', 'employee', 'status_change', 'employee', 1, 'تم تغيير الوظيفة إلى "بائع"', 1, 'admin', NULL),
(23, '2026-02-24 19:04:58', 'employee', 'status_change', 'employee', 3, 'يعمل → إجازة (2026-02-24)', 1, 'admin', NULL),
(24, '2026-02-24 19:05:29', 'employee', 'status_change', 'employee', 3, 'تحديث تفاصيل عمل علي', 1, 'admin', NULL),
(25, '2026-02-24 19:06:52', 'employee', 'status_change', 'employee', 3, 'تحديث تفاصيل عمل علي', 1, 'admin', NULL),
(26, '2026-02-24 19:07:16', 'employee', 'status_change', 'employee', 3, 'إجازة → يعمل (2026-02-25)؛ تاريخ العودة للعمل: 2026-02-25', 1, 'admin', NULL),
(27, '2026-02-24 19:10:04', 'employee', 'status_change', 'employee', 1, 'تحديث تفاصيل عمل محمد الخطيب', 1, 'admin', NULL),
(28, '2026-02-24 19:10:16', 'employee', 'status_change', 'employee', 1, 'تحديث تفاصيل عمل محمد الخطيب', 1, 'admin', NULL),
(29, '2026-02-24 19:37:38', 'employee', 'status_change', 'employee', 1, 'تحديث تفاصيل عمل محمد الخطيب', 1, 'admin', NULL),
(30, '2026-02-24 19:38:03', 'employee', 'status_change', 'employee', 3, 'يعمل → إجازة (2026-02-24)', 1, 'admin', NULL),
(31, '2026-02-24 19:39:50', 'employee', 'status_change', 'employee', 3, 'إجازة → يعمل (2026-02-25)؛ تاريخ العودة للعمل: 2026-02-25', 1, 'admin', NULL),
(32, '2026-02-24 19:45:56', 'employee', 'status_change', 'employee', 1, 'تحديث تفاصيل عمل محمد الخطيب', 1, 'admin', NULL),
(33, '2026-02-24 19:47:19', 'employee', 'status_change', 'employee', 1, 'تحديث تفاصيل عمل محمد الخطيب', 1, 'admin', NULL),
(34, '2026-02-24 19:47:27', 'employee', 'status_change', 'employee', 1, 'تم تغيير الراتب من ٤٬٠٠٠ إلى ٤٬٥٠٠ درهم — زيادة ٥٠٠ درهم', 1, 'admin', NULL),
(35, '2026-02-24 19:47:44', 'employee', 'status_change', 'employee', 1, 'تم تغيير الوظيفة إلى "سائق"', 1, 'admin', NULL),
(36, '2026-02-25 13:56:24', 'employee', 'status_change', 'employee', 2, 'معار → يعمل (2026-02-25)', 1, 'admin', NULL),
(37, '2026-03-10 16:09:49', 'housing', 'assign_occupant', 'housing', 1, 'تعيين ساكن: احمد رزق (occupant) في سكن عمال المشغل', 1, 'admin', NULL),
(38, '2026-03-10 16:27:46', 'housing', 'assign_occupant', 'housing', 1, 'تعيين ساكن: علي (occupant) في سكن عمال المشغل', 1, 'admin', NULL),
(39, '2026-03-10 17:21:37', 'housing', 'remove_occupant', 'housing', 1, 'إزالة ساكن: احمد رزق من سكن عمال المشغل', 1, 'admin', NULL),
(40, '2026-03-10 18:09:42', 'housing', 'remove_occupant', 'housing', 1, 'إزالة ساكن: علي من سكن عمال المشغل', 1, 'admin', NULL),
(41, '2026-03-10 19:04:51', 'archive', 'archive', 'branch', 5, 'تمت أرشفة فرع: موقع الرداء الموحد بواسطة Super Admin', 1, 'Super Admin', NULL),
(42, '2026-03-10 19:05:01', 'archive', 'restore', 'branch', 5, 'تمت استعادة فرع: موقع الرداء الموحد بواسطة Super Admin', 1, 'Super Admin', NULL),
(43, '2026-03-10 22:25:37', 'archive', 'archive', 'branch', 5, 'تمت أرشفة فرع: موقع الرداء الموحد بواسطة Super Admin', 1, 'Super Admin', NULL),
(44, '2026-03-10 22:25:48', 'archive', 'restore', 'branch', 5, 'تمت استعادة فرع: موقع الرداء الموحد بواسطة Super Admin', 1, 'Super Admin', NULL),
(45, '2026-03-12 00:11:56', 'employee', 'status_change', 'employee', 1, 'تم تغيير الوظيفة إلى "بائع"', 1, 'admin', NULL),
(46, '2026-03-12 01:08:43', 'archive', 'archive', 'branch', 5, 'تمت أرشفة فرع: موقع الرداء الموحد بواسطة Super Admin', 1, 'Super Admin', NULL),
(47, '2026-03-12 01:08:59', 'archive', 'restore', 'branch', 5, 'تمت استعادة فرع: موقع الرداء الموحد بواسطة Super Admin', 1, 'Super Admin', NULL),
(48, '2026-03-12 16:56:12', 'vehicle', 'assign_responsible', 'vehicle', 1, 'تعيين مسؤول المركبة: عبدالقادر الخطيب (80097)', 1, 'admin', NULL),
(49, '2026-03-21 22:39:26', 'housing', 'installment_mark_paid', 'housing', 1, 'housingInstallment::3::seq 1::paid', 1, 'RME0001', 'RME0001');

INSERT INTO `branches` (`id`, `name`, `nameEn`, `phone`, `emirate`, `address`, `branchType`, `isAttached`, `attachedToId`, `photoPath`, `status`, `createdAt`, `updatedAt`, `country`, `tradeLicenseNo`, `tradeLicenseExpiry`, `establishmentCardNo`, `establishmentCardExpiry`, `workHours`, `workTimingSlots`, `city`, `code`, `googleMapUrl`) VALUES
(1, 'مزايا', NULL, NULL, 'dubai', 'دبي مركز مزايا', 'workshop', 0, NULL, NULL, 'active', '2026-02-19 21:21:00', '2026-02-19 21:21:00', 'United Arab Emirates', NULL, NULL, NULL, NULL, NULL, '{"sat":{"enabled":false,"slots":[]},"sun":{"enabled":false,"slots":[]},"mon":{"enabled":false,"slots":[]},"tue":{"enabled":false,"slots":[]},"wed":{"enabled":false,"slots":[]},"thu":{"enabled":false,"slots":[]},"fri":{"enabled":false,"slots":[]}}', 'دبي', 'RMB0001', NULL),
(2, 'ابوظبي المرور', NULL, NULL, 'abu_dhabi', 'ابوظبي', 'store', 0, NULL, NULL, 'active', '2026-02-19 21:21:28', '2026-02-19 21:21:28', 'United Arab Emirates', NULL, NULL, NULL, NULL, NULL, '{"sat":{"enabled":false,"slots":[]},"sun":{"enabled":false,"slots":[]},"mon":{"enabled":false,"slots":[]},"tue":{"enabled":false,"slots":[]},"wed":{"enabled":false,"slots":[]},"thu":{"enabled":false,"slots":[]},"fri":{"enabled":false,"slots":[]}}', 'abu_dhabi', 'RMB0002', NULL),
(4, 'بين الجسرين', NULL, NULL, 'abu_dhabi', 'جنب مسجد الشيخ حمدان', 'workshop', 0, NULL, 'images/branches/branch_1771608056663.png', 'active', '2026-02-19 21:34:06', '2026-02-19 21:34:06', 'United Arab Emirates', NULL, NULL, NULL, NULL, 'single_shift', '{"sat":{"enabled":true,"slots":[{"from":"10:00","to":"22:00"}]},"sun":{"enabled":true,"slots":[{"from":"10:00","to":"22:00"}]},"mon":{"enabled":true,"slots":[{"from":"10:00","to":"22:00"}]},"tue":{"enabled":true,"slots":[{"from":"10:00","to":"22:00"}]},"wed":{"enabled":true,"slots":[{"from":"10:00","to":"22:00"}]},"thu":{"enabled":true,"slots":[{"from":"10:00","to":"22:00"}]},"fri":{"enabled":true,"slots":[{"from":"16:00","to":"22:00"}]}}', 'ابوظبي', 'RMB0003', NULL),
(5, 'موقع الرداء الموحد', 'alredaa-almuwahad.com', NULL, 'abu_dhabi', 'جنب مسجد الشيخ حمدان', 'website', 0, 4, NULL, 'active', '2026-02-22 13:58:57', '2026-02-22 13:58:57', 'United Arab Emirates', NULL, NULL, NULL, NULL, NULL, '{"_24h":true}', 'ابوظبي', 'RMB0004', NULL);

INSERT INTO `employee_status_history` (`id`, `employeeId`, `status`, `startDate`, `endDate`, `durationDays`, `performedByUserId`, `performedByUsername`, `createdAt`) VALUES
(1, 3, 'leave', '2026-02-22', '2026-02-22', 0, 1, 'admin', '2026-02-22 19:30:35'),
(2, 3, 'active', '2026-02-22', NULL, NULL, 1, 'admin', '2026-02-22 19:30:35');

INSERT INTO `employees` (`id`, `imagePath`, `name`, `phone`, `email`, `nationality`, `passportNumber`, `passportExpiry`, `passportCountry`, `profession`, `contractType`, `contractStartDate`, `contractExpiryDate`, `workLicense`, `workCardNumber`, `workCardExpiry`, `workBranchId`, `legalEntityId`, `establishmentId`, `emiratesId`, `emiratesIdExpiry`, `basicSalary`, `housingAllowance`, `transportAllowance`, `otherAllowances`, `totalSalary`, `actualSalary`, `status`, `notes`, `createdAt`, `updatedAt`, `passportIssueDate`, `issueEmirate`, `employerName`, `establishmentNumber`, `loanType`, `targetEntityName`, `loanExpiryDate`, `tempContractNumber`, `loanSalary`, `professionCustomTitle`, `professionKeys`, `healthInsuranceEnabled`, `healthInsuranceProvider`, `healthInsuranceIssueDate`, `healthInsuranceExpiryDate`, `unemploymentInsuranceEnabled`, `unemploymentInsuranceProvider`, `unemploymentInsuranceIssueDate`, `unemploymentInsuranceExpiryDate`, `professionPerContract`, `loanBranchId`, `loanProfession`, `loanSubStatus`, `immigrationEstablishmentNumber`, `emiratesIdIssueDate`, `contractBranchId`, `code`, `loanLeaveStartDate`, `loanLeaveEndDate`, `userId`) VALUES
(1, 'images/branches/employee_1771693925567.jpeg', 'محمد الخطيب', '0544405432', 'm.khatib.1996@gmail.com', 'سوري', 'N 0152252', '2028-04-01', NULL, 'بائع', 'permanent', '2025-02-01', '2027-02-01', NULL, NULL, NULL, 2, NULL, NULL, '784199615203', '2026-06-16', 1500, 500, 200, NULL, 2200, 4500, 'seconded', NULL, '2026-02-20 21:33:51', '2026-02-20 21:33:51', '2023-04-01', 'abu_dhabi', 'الرداء الموحد للملابس الجاهزة', '12525', 'internal', NULL, '2027-02-01', '225', 500, NULL, '["salesman"]', 1, 'كك', '2026-02-01', '2027-02-03', 1, NULL, '2025-02-01', '2026-02-28', 'مدير', 1, 'بائع', 'active', '12232', NULL, 4, 'RME0001', '2026-02-24', '2026-02-25', NULL),
(2, NULL, 'احمد رزق', '0521456541', NULL, 'مصري', '12366', '2027-02-04', NULL, 'بائع', 'temporary', '2025-03-01', '2026-03-01', NULL, NULL, NULL, 2, NULL, NULL, '784199612505', '2026-03-05', 1500, 500, 500, NULL, 2500, 2500, 'active', NULL, '2026-02-22 16:00:50', '2026-02-22 16:00:50', '2025-02-01', 'dubai', 'علي القابضة', '123333', NULL, NULL, NULL, NULL, NULL, NULL, '["salesman"]', 1, NULL, '2026-02-28', '2027-02-27', 1, NULL, '2025-03-01', '2026-03-01', 'كاتب ارشيف', NULL, NULL, NULL, NULL, '2025-03-04', 1, 'RME0002', NULL, NULL, NULL),
(3, NULL, 'علي', NULL, NULL, 'سوري', '12522', '2027-02-01', NULL, 'بائع، سائق', 'permanent', '2026-02-01', '2027-02-01', NULL, NULL, NULL, 1, NULL, NULL, '7984199692625', '2027-02-01', 2000, 1500, NULL, NULL, 3500, 4500, 'active', NULL, '2026-02-22 18:21:29', '2026-02-22 18:21:29', '2022-02-01', 'dubai', 'شركة الرداء الموحد للملابس الجاهزة', '123333', NULL, NULL, NULL, NULL, NULL, NULL, '["salesman","driver"]', 0, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '321111', '2026-02-01', 1, 'RME0003', NULL, NULL, NULL);

INSERT INTO `employers` (`id`, `code`, `photoPath`, `fullName`, `fullNameEn`, `nationality`, `phone`, `email`, `passportNumber`, `passportIssueDate`, `passportExpiry`, `passportCountry`, `emiratesId`, `emiratesIdIssueDate`, `emiratesIdExpiry`, `occupation`, `notes`, `status`, `createdAt`, `updatedAt`, `issueEmirate`, `primaryPhoneId`, `userId`) VALUES
(1, 'RMO0001', 'images/branches/employer_1773320410571.png', 'عبدالقادر الخطيب', 'abdulkader', 'سوري', NULL, 'alkateeb@me.com', '015228', '2024-03-01', '2026-04-08', 'syria', '784197745656', '2025-03-01', '2026-03-31', NULL, NULL, 'active', '2026-03-11 16:07:55', '2026-03-11 16:07:55', NULL, NULL, NULL);

INSERT INTO `entities` (`id`, `name`, `nameEn`, `tradeLicenseNumber`, `tradeLicenseExpiry`, `vatTrn`, `vatRegDate`, `corporateTaxTrn`, `corporateTaxRegDate`, `mainBranchId`, `status`, `notes`, `createdAt`, `updatedAt`, `trn`, `corporateTaxGiban`, `vatFilingCycle`, `entityNickname`, `registeredAddress`, `contactNumber`, `financialYearEnd`) VALUES
(3, 'بين', NULL, NULL, NULL, NULL, '2018-01-01', NULL, '2023-06-01', 4, 'active', NULL, '2026-02-20 15:03:55', '2026-02-20 15:03:55', '100003698745123', '100003698745121', 'quarterly', 'ابوظبي وفروعها', NULL, '0544405432', NULL);

-- (no data in housing_custom_fields)

INSERT INTO `housing_installments` (`id`, `housingId`, `seq`, `dueDate`, `amount`, `paid`, `paidAt`, `note`, `createdAt`) VALUES
(3, 1, 0, '2026-01-01', 15000, 1, '2026-03-21 22:39:26', NULL, '2026-02-25 20:51:47'),
(4, 1, 1, '2026-06-01', 15000, 0, NULL, NULL, '2026-02-25 20:51:47');

-- (no data in housing_occupants)

INSERT INTO `housing_units` (`id`, `name`, `housingType`, `emirate`, `contractNo`, `contractIssue`, `contractExpiry`, `rentAmount`, `paymentMethod`, `installmentsCount`, `ownedBy`, `branchId`, `employeeId`, `createdAt`, `updatedAt`, `code`, `address`, `landlordName`, `tenantDisplayName`, `status`, `employerId`) VALUES
(1, 'سكن عمال المشغل', 'labour', 'abu_dhabi', '159999', '2025-02-01', '2026-02-01', 30000, NULL, 2, 'company', 4, NULL, '2026-02-25 20:46:13', '2026-02-25 20:46:13', 'RMH0001', NULL, 'علي', 'الرداء الموحد للملابس الجاهزة', 'active', NULL);

INSERT INTO `lease_installments` (`id`, `leaseId`, `seq`, `dueDate`, `amount`, `paid`, `paidAt`, `note`, `createdAt`) VALUES
(41, 1, 0, '2026-03-01', 30000, 0, NULL, NULL, '2026-03-11 13:45:34'),
(42, 1, 1, '2026-06-01', 30000, 0, NULL, NULL, '2026-03-11 13:45:34'),
(43, 1, 2, '2026-09-01', 30000, 0, NULL, NULL, '2026-03-11 13:45:34'),
(44, 1, 3, '2026-12-01', 30000, 0, NULL, NULL, '2026-03-11 13:45:34');

INSERT INTO `notifications` (`id`, `entityType`, `entityId`, `title`, `message`, `dueDate`, `severity`, `isRead`, `relatedField`, `createdAt`, `isArchived`, `readAt`) VALUES
(9, 'employer', 1, 'employerPassport::expiringSoonMale', 'entityMsg::عبدالقادر الخطيب::2026-04-08', '2026-04-08', 'warning', 0, 'employer-passport-1', '2026-03-17 23:02:25', 0, NULL),
(10, 'employer', 1, 'employerEmiratesId::expiringSoonMale', 'entityMsg::عبدالقادر الخطيب::2026-03-31', '2026-03-31', 'warning', 0, 'employer-emiratesId-1', '2026-03-17 23:02:25', 0, NULL),
(11, 'employee', 1, 'emiratesId::expiry', 'entityMsg::محمد الخطيب::2026-06-16', '2026-06-16', 'info', 0, 'employee-emiratesId-1', '2026-03-18 00:19:24', 0, NULL),
(12, 'branch', 4, 'leaseAgreement::expiredMale', 'branchMsg::بين الجسرين::2026-02-01', '2026-02-01', 'danger', 0, 'branch-lease-1', '2026-03-25 10:24:38', 0, NULL),
(13, 'branch', 1, 'establishmentCard::expiringSoon', 'branchMsg::مزايا::2026-03-31', '2026-03-31', 'warning', 0, 'branch-establishment-2', '2026-03-25 10:24:38', 0, NULL),
(14, 'branch', 4, 'customField::expiredMale::المطافي', 'branchMsg::بين الجسرين::2026-02-25', '2026-02-25', 'danger', 0, 'branch-custom-43', '2026-03-25 10:24:38', 0, NULL),
(15, 'employee', 1, 'unemploymentInsurance::expiredMale', 'entityMsg::محمد الخطيب::2026-02-28', '2026-02-28', 'danger', 0, 'employee-unemployment-1', '2026-03-25 10:24:38', 0, NULL),
(16, 'employee', 2, 'emiratesId::expiredMale', 'entityMsg::احمد رزق::2026-03-05', '2026-03-05', 'danger', 0, 'employee-emiratesId-2', '2026-03-25 10:24:38', 0, NULL),
(17, 'employee', 2, 'workContract::expiredMale', 'entityMsg::احمد رزق::2026-03-01', '2026-03-01', 'danger', 0, 'employee-contract-2', '2026-03-25 10:24:38', 0, NULL),
(18, 'employee', 2, 'unemploymentInsurance::expiredMale', 'entityMsg::احمد رزق::2026-03-01', '2026-03-01', 'danger', 0, 'employee-unemployment-2', '2026-03-25 10:24:38', 0, NULL),
(19, 'housing', 1, 'housingContract::expiredMale', 'entityMsg::سكن عمال المشغل::2026-02-01', '2026-02-01', 'danger', 0, 'housing-contract-1', '2026-03-25 10:24:38', 0, NULL);

INSERT INTO `permissions` (`id`, `module`, `action`, `labelKey`) VALUES
(1, 'employees', 'view', 'employees.view'),
(2, 'employees', 'create', 'employees.create'),
(3, 'employees', 'edit', 'employees.edit'),
(4, 'employees', 'delete', 'employees.delete'),
(5, 'employees', 'archive', 'employees.archive'),
(6, 'employees', 'manage', 'employees.manage'),
(7, 'branches', 'view', 'branches.view'),
(8, 'branches', 'create', 'branches.create'),
(9, 'branches', 'edit', 'branches.edit'),
(10, 'branches', 'delete', 'branches.delete'),
(11, 'branches', 'archive', 'branches.archive'),
(12, 'branches', 'manage', 'branches.manage'),
(13, 'housing', 'view', 'housing.view'),
(14, 'housing', 'create', 'housing.create'),
(15, 'housing', 'edit', 'housing.edit'),
(16, 'housing', 'delete', 'housing.delete'),
(17, 'housing', 'archive', 'housing.archive'),
(18, 'housing', 'manage', 'housing.manage'),
(19, 'vehicles', 'view', 'vehicles.view'),
(20, 'vehicles', 'create', 'vehicles.create'),
(21, 'vehicles', 'edit', 'vehicles.edit'),
(22, 'vehicles', 'delete', 'vehicles.delete'),
(23, 'vehicles', 'archive', 'vehicles.archive'),
(24, 'vehicles', 'manage', 'vehicles.manage'),
(25, 'employers', 'view', 'employers.view'),
(26, 'employers', 'create', 'employers.create'),
(27, 'employers', 'edit', 'employers.edit'),
(28, 'employers', 'delete', 'employers.delete'),
(29, 'employers', 'archive', 'employers.archive'),
(30, 'employers', 'manage', 'employers.manage'),
(31, 'phones', 'view', 'phones.view'),
(32, 'phones', 'create', 'phones.create'),
(33, 'phones', 'edit', 'phones.edit'),
(34, 'phones', 'delete', 'phones.delete'),
(35, 'phones', 'archive', 'phones.archive'),
(36, 'phones', 'manage', 'phones.manage'),
(37, 'entities', 'view', 'entities.view'),
(38, 'entities', 'create', 'entities.create'),
(39, 'entities', 'edit', 'entities.edit'),
(40, 'entities', 'delete', 'entities.delete'),
(41, 'entities', 'archive', 'entities.archive'),
(42, 'entities', 'manage', 'entities.manage'),
(43, 'documents', 'view', 'documents.view'),
(44, 'documents', 'create', 'documents.create'),
(45, 'documents', 'edit', 'documents.edit'),
(46, 'documents', 'delete', 'documents.delete'),
(47, 'documents', 'archive', 'documents.archive'),
(48, 'documents', 'manage', 'documents.manage'),
(49, 'settings', 'view', 'settings.view'),
(50, 'settings', 'create', 'settings.create'),
(51, 'settings', 'edit', 'settings.edit'),
(52, 'settings', 'delete', 'settings.delete'),
(53, 'settings', 'archive', 'settings.archive'),
(54, 'settings', 'manage', 'settings.manage'),
(55, 'users', 'view', 'users.view'),
(56, 'users', 'create', 'users.create'),
(57, 'users', 'edit', 'users.edit'),
(58, 'users', 'delete', 'users.delete'),
(59, 'users', 'archive', 'users.archive'),
(60, 'users', 'manage', 'users.manage'),
(61, 'logs', 'view', 'logs.view'),
(62, 'logs', 'create', 'logs.create'),
(63, 'logs', 'edit', 'logs.edit'),
(64, 'logs', 'delete', 'logs.delete'),
(65, 'logs', 'archive', 'logs.archive'),
(66, 'logs', 'manage', 'logs.manage');

INSERT INTO `phones` (`id`, `assignedBranchId`, `assignedEmployeeId`, `status`, `note`, `createdAt`, `updatedAt`, `phoneNumber`, `provider`, `category`, `numberType`, `billAmount`, `legalEntityId`, `registeredName`, `assignedHousingId`, `assignedEmployerId`, `code`) VALUES
(1, NULL, 1, 'active', NULL, '2026-03-10 20:13:16', '2026-03-10 20:13:16', '0544405432', 'etisalat', 'postpaid', 'mobile', 250, 4, NULL, NULL, 'RMP0001', 'RMP0001'),
(2, 2, NULL, 'active', NULL, '2026-03-10 20:14:39', '2026-03-10 20:14:39', '065502414', 'etisalat', 'postpaid', 'landline', NULL, 4, NULL, NULL, 'RMP0002', 'RMP0002'),
(3, NULL, NULL, 'active', NULL, '2026-03-12 13:01:45', '2026-03-12 13:01:45', '0544405434', 'etisalat', 'postpaid', 'mobile', 140, 4, NULL, NULL, 1, 'RMP0003');

INSERT INTO `role_permissions` (`roleId`, `permissionId`) VALUES
(1, 11),
(1, 8),
(1, 10),
(1, 9),
(1, 12),
(1, 7),
(1, 47),
(1, 44),
(1, 46),
(1, 45),
(1, 48),
(1, 43),
(1, 5),
(1, 2),
(1, 4),
(1, 3),
(1, 6),
(1, 1),
(1, 29),
(1, 26),
(1, 28),
(1, 27),
(1, 30),
(1, 25),
(1, 41),
(1, 38),
(1, 40),
(1, 39),
(1, 42),
(1, 37),
(1, 17),
(1, 14),
(1, 16),
(1, 15),
(1, 18),
(1, 13),
(1, 65),
(1, 62),
(1, 64),
(1, 63),
(1, 66),
(1, 61),
(1, 35),
(1, 32),
(1, 34),
(1, 33),
(1, 36),
(1, 31),
(1, 53),
(1, 50),
(1, 52),
(1, 51),
(1, 54),
(1, 49),
(1, 59),
(1, 56),
(1, 58),
(1, 57),
(1, 60),
(1, 55),
(1, 23),
(1, 20),
(1, 22),
(1, 21),
(1, 24),
(1, 19),
(2, 11),
(3, 8),
(2, 8),
(3, 9),
(2, 9),
(4, 7),
(3, 7),
(2, 7),
(2, 47),
(3, 44),
(2, 44),
(3, 45),
(2, 45),
(4, 43),
(3, 43),
(2, 43),
(2, 5),
(3, 2),
(2, 2),
(3, 3),
(2, 3),
(4, 1),
(3, 1),
(2, 1),
(2, 29),
(3, 26),
(2, 26),
(3, 27),
(2, 27),
(4, 25),
(3, 25),
(2, 25),
(2, 41),
(3, 38),
(2, 38),
(3, 39),
(2, 39),
(4, 37),
(3, 37),
(2, 37),
(2, 17),
(3, 14),
(2, 14),
(3, 15),
(2, 15),
(4, 13),
(3, 13),
(2, 13),
(2, 65),
(3, 62),
(2, 62),
(3, 63),
(2, 63),
(4, 61),
(3, 61),
(2, 61),
(2, 35),
(3, 32),
(2, 32),
(3, 33),
(2, 33),
(4, 31),
(3, 31),
(2, 31),
(2, 53),
(3, 50),
(2, 50),
(3, 51),
(2, 51),
(4, 49),
(3, 49),
(2, 49),
(2, 59),
(3, 56),
(2, 56),
(3, 57),
(2, 57),
(4, 55),
(3, 55),
(2, 55),
(2, 23),
(3, 20),
(2, 20),
(3, 21),
(2, 21),
(4, 19),
(3, 19),
(2, 19);

INSERT INTO `roles` (`id`, `name`, `description`, `isSystem`) VALUES
(1, 'Admin', 'مدير النظام', 1),
(2, 'Manager', 'مدير عمليات', 1),
(3, 'Staff', 'موظف إدخال', 1),
(4, 'Viewer', 'عرض فقط', 1);

INSERT INTO `settings` (`id`, `key`, `value`, `updatedAt`) VALUES
(1, 'defaultLanguage', 'ar', '2026-03-21 20:53:38'),
(2, 'companyName', 'الرداء الموحد', '2026-03-12 17:40:32'),
(3, 'notificationsEnabled', '1', '2026-03-21 21:56:29'),
(4, 'expiryWarningDays', '30', '2026-03-21 21:56:29'),
(5, 'showGreenExpiry', '1', '2026-03-21 21:56:29'),
(6, 'showYellowExpiry', '1', '2026-03-21 21:56:29'),
(7, 'notificationSoundEnabled', '1', '2026-03-21 21:56:29'),
(8, 'desktopNotificationsEnabled', '1', '2026-03-21 21:56:29');

INSERT INTO `status_history` (`id`, `entityType`, `entityId`, `status`, `startDate`, `endDate`, `durationDays`, `performedByUserId`, `performedByUsername`, `createdAt`, `performedByUserCode`) VALUES
(1, 'employee', 3, 'leave', '2026-02-22', '2026-02-23', 1, 1, 'admin', '2026-02-22 19:30:35', NULL),
(2, 'employee', 3, 'active', '2026-02-22', NULL, NULL, 1, 'admin', '2026-02-22 19:30:35', NULL),
(3, 'employee', 3, 'leave', '2026-02-21', NULL, NULL, 1, 'admin', '2026-02-22 19:39:20', NULL),
(4, 'employee', 3, 'active', '2026-02-23', '2026-02-24', 1, 1, 'admin', '2026-02-22 19:39:42', NULL),
(5, 'employee', 1, 'seconded', '2026-02-22', NULL, NULL, 1, 'admin', '2026-02-22 20:38:11', NULL),
(6, 'employee', 3, 'leave', '2026-02-24', '2026-02-25', 1, 1, 'admin', '2026-02-24 19:04:58', NULL),
(7, 'employee', 3, 'active', '2026-02-25', '2026-02-25', 0, 1, 'admin', '2026-02-24 19:07:16', NULL),
(8, 'employee', 3, 'leave', '2026-02-24', NULL, NULL, 1, 'admin', '2026-02-24 19:38:03', NULL),
(9, 'employee', 3, 'active', '2026-02-25', NULL, NULL, 1, 'admin', '2026-02-24 19:39:50', NULL),
(10, 'employee', 2, 'seconded', '2026-02-25', '2026-02-25', 0, 1, 'admin', '2026-02-25 13:56:24', NULL),
(11, 'employee', 2, 'active', '2026-02-25', NULL, NULL, 1, 'admin', '2026-02-25 13:56:24', NULL);

INSERT INTO `tax_entity_branches` (`entityId`, `branchId`) VALUES
(3, 4),
(3, 1);

-- (no data in tax_payments)

-- (no data in user_permissions)

INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `email`, `roleId`, `isActive`, `lastLoginAt`, `createdAt`, `updatedAt`, `userType`, `linkedEntityType`, `linkedEntityId`, `mustChangePassword`, `passwordChangedAt`, `role`, `branchId`, `entityId`, `avatarPath`) VALUES
(1, 'RME0001', '$2b$10$Aw64/s63Kt1kVbE6uYaipOIG2IFhVm/vJp/KRGwJx.VwEb.NWVDqC', 'محمد الخطيب', '', 1, 1, '2026-03-25 16:58:13', '2026-03-17 23:22:08', '2026-03-25 16:58:13', 'linked', 'employee', 1, 1, NULL, 'Employee', NULL, NULL, NULL),
(2, 'admin', '$2b$10$b2uHOj7TSOcgdbQ8bFx2eudj5rjAbk5aitQwyDzV6jcDc2nF9EaqS', 'admin', '', 1, 1, '2026-03-24 15:29:28', '2026-03-18 00:36:40', '2026-03-25 17:57:24', 'free', NULL, NULL, 1, NULL, 'Employee', NULL, NULL, NULL);

INSERT INTO `vehicle_custom_fields` (`id`, `vehicleId`, `title`, `content`, `enableAlert`, `alertDate`, `daysBeforeExpiry`, `createdAt`, `updatedAt`) VALUES
(4, 1, 'تصريحح الاعلان', '{"rows":[{"id":"r3-0","key":"رقم التصريح","value":"10025002","isDate":false,"enableAlert":false,"daysBeforeExpiry":30},{"id":"r3-1","key":"تاريخ الاصدار ","value":"2026-02-01","isDate":true,"enableAlert":false,"daysBeforeExpiry":30},{"id":"r3-2","key":"تاريخ الانتهاء","value":"2027-02-01","isDate":true,"enableAlert":true,"alertDate":"2027-02-01","daysBeforeExpiry":30}]}', 1, '2027-02-01', 30, '2026-02-24 18:07:09', '2026-02-24 18:07:09');

INSERT INTO `vehicles` (`id`, `model`, `year`, `insuranceType`, `insuranceCompany`, `insuranceExpiryDate`, `plateNumber`, `branchId`, `status`, `createdAt`, `updatedAt`, `code`, `photoPath`, `brand`, `vehicleType`, `ownershipType`, `ownerName`, `issuePlace`, `trafficNo`, `chassisNo`, `engineNo`, `licenseRegDate`, `licenseExpiryDate`, `insurancePolicyNo`, `responsibleEmployeeId`, `responsibleName`, `plateCode`, `vehicleName`, `responsibleEmployerId`) VALUES
(1, 'H1', 2019, 'third_party', 'الوثبة', '2027-03-01', '80097', 1, 'active', '2026-02-23 13:38:31', '2026-02-23 13:38:31', 'RMV0001', NULL, 'هيونداي', 'bus', 'company', 'شركة الرداء الموحد للملابس الجاهزة', 'دبي', NULL, NULL, NULL, '2026-02-01', '2027-02-01', NULL, NULL, 'عبدالقادر الخطيب', 'M', NULL, 1);

INSERT INTO `documents` (`id`, `relativePath`, `customName`, `entityType`, `entityId`, `section`, `createdAt`, `isArchived`) VALUES
(4, 'Taxes/3/vat_cert/شهادة تسجيل ضريبة القيمة المظافة.pdf', 'شهادة تسجيل ضريبة القيمة المظافة', 'entity', 3, 'vat_cert', '2026-02-20 18:08:02', 0),
(5, 'Employees/محمود الخطيب/passport/جواز محمود.pdf', 'جواز محمود.pdf', 'employee', 0, 'passport', '2026-02-20 21:27:54', 0),
(8, 'Branches/4/trade_license/رخصة ابوظبي.pdf', 'رخصة ابوظبي', 'branch', 4, 'trade_license', '2026-03-11 13:45:34', 0),
(9, 'Employers/1/residency/هنا_page-0001.jpg', 'هنا_page-0001.jpg', 'employer', 1, 'residency', '2026-03-12 12:14:30', 0);

INSERT INTO `branch_leases` (`id`, `branchId`, `contractNo`, `landlordName`, `amount`, `issueDate`, `expiryDate`, `paymentMethod`, `installmentsCount`, `createdAt`, `updatedAt`) VALUES
(1, 4, '122225', 'محمود', 120000, '2026-02-01', '2026-02-01', NULL, 1, '2026-02-19 21:34:06', '2026-02-19 21:34:06');

INSERT INTO `branch_licenses` (`id`, `branchId`, `licenseNo`, `tradeName`, `issueDate`, `expiryDate`, `renewalFee`, `createdAt`, `updatedAt`, `tradeNameEn`) VALUES
(1, 4, '1225', 'الرداء الموحد للملابس الجاهزة', '2025-02-01', '2027-02-01', NULL, '2026-02-19 21:34:06', '2026-02-19 21:34:06', NULL),
(2, 1, '1234555', 'شركة الرداء الموحد للملابس الجاهزة', '2026-01-01', '2027-01-01', NULL, '2026-02-21 16:54:04', '2026-02-21 16:54:04', NULL),
(3, 5, 'الرداء الموحد لليونيفورم', 'موقع الرداء الموحد', NULL, NULL, NULL, '2026-03-10 20:08:06', '2026-03-10 20:08:06', NULL);

INSERT INTO `branch_custom_fields` (`id`, `branchId`, `title`, `content`, `enableAlert`, `alertDate`, `daysBeforeExpiry`, `createdAt`, `updatedAt`) VALUES
(43, 4, 'المطافي', '{"rows":[{"id":"r1","key":"رقم المطافي","value":"1141","isDate":false,"enableAlert":false,"alertDate":"","daysBeforeExpiry":30},{"id":"r1771554238977","key":"تاريخ الانتهاء ","value":"2026-02-25","isDate":true,"enableAlert":true,"alertDate":"2026-02-25","daysBeforeExpiry":30},{"id":"r1771554302599","key":"تاريخ الاصداء ","value":"2026-02-01","isDate":true,"enableAlert":false,"alertDate":"","daysBeforeExpiry":30}]}', 1, '2026-02-25', 30, '2026-03-11 13:45:34', '2026-03-11 13:45:34'),
(44, 5, 'دومين الموقع', '{"rows":[{"id":"r1","key":"انتهاء تاريخ الدومين","value":"2027-04-01","isDate":true,"enableAlert":true,"alertDate":"2027-04-01","daysBeforeExpiry":30}]}', 1, '2027-04-01', 30, '2026-03-12 01:08:13', '2026-03-12 01:08:13');

INSERT INTO `branch_employers` (`id`, `branchId`, `employerId`, `role`, `ownershipPercent`, `createdAt`) VALUES
(3, 1, 1, 'owner', 100, '2026-03-12 12:27:16');

INSERT INTO `branch_establishments` (`id`, `branchId`, `isEnabled`, `mohreEstNo`, `gdrfaEstNo`, `gdrfaIssueDate`, `gdrfaExpiryDate`, `createdAt`, `updatedAt`, `laborEstablishmentCardNo`, `immigrationEstablishmentCardNo`, `immigrationCardIssueDate`, `immigrationCardExpiryDate`, `trn`, `corporateTaxRegistration`) VALUES
(1, 4, 1, NULL, NULL, NULL, NULL, '2026-02-19 21:34:06', '2026-02-19 21:34:06', '12525', '12232', '2026-02-01', '2028-02-01', NULL, NULL),
(2, 1, 1, NULL, NULL, NULL, NULL, '2026-02-21 17:08:10', '2026-02-21 17:08:10', '123333', '321111', '2026-02-01', '2026-03-31', NULL, NULL);

SET FOREIGN_KEY_CHECKS = 1;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
