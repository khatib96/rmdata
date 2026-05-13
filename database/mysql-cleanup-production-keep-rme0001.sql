-- =============================================================================
-- تنظيف قاعدة بيانات الإنتاج (MySQL / MariaDB)
-- يحذف كل البيانات التشغيلية ويبقي:
--   - الموظف ذو code = RME0001 (يُبقى الاسم والرمز فقط، تُفرغ بقية أعمدة الموظف)
--   - المستخدم المرتبط (username = RME0001 أو مربوط بنفس الموظف): يبقى الدخول وكلمة المرور والدور
--   - جداول الأدوار والصلاحيات الجاهزة (roles, permissions, role_permissions)
--
-- ⚠️ قبل التنفيذ إلزامياً:
--   1) نسخة احتياطية كاملة (Export / mysqldump).
--   2) التأكد أن لديك نسخة من البيانات على قاعدة التجريب (rmtest).
--   3) تنفيذ هذا الملف على قاعدة الإنتاج فقط، وليس على rmtest إن أردت الإبقاء على نسخة كاملة هناك.
--
-- ⚠️ جدول connected_devices: إن لم يكن موجوداً، علّق أو احذف السطر DELETE الخاص به.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- تحديد الموظف المراد الإبقاء عليه (الرمز غير حساس لحالة الأحرف)
SET @keep_emp_id := (
  SELECT id FROM employees
  WHERE UPPER(TRIM(code)) = 'RME0001'
  ORDER BY id ASC
  LIMIT 1
);

-- تحديد المستخدم: أولاً بالاسم، ثم بالربط مع الموظف
SET @keep_user_id := COALESCE(
  (SELECT id FROM users WHERE UPPER(TRIM(username)) = 'RME0001' ORDER BY id ASC LIMIT 1),
  (SELECT id FROM users WHERE linkedEntityType = 'employee' AND linkedEntityId = @keep_emp_id ORDER BY id ASC LIMIT 1)
);

-- إيقاف يدوي إن لم يُعثر على الموظف (لا تكمل التنفيذ)
-- بعد تشغيل الجزء أعلاه، نفّذ: SELECT @keep_emp_id AS emp_id, @keep_user_id AS user_id;
-- إذا emp_id فارغ (NULL) — لا تشغّل باقي الملف.

-- ---------------------------------------------------------------------------
-- 1) سجلات ووثائق وإشعارات
-- ---------------------------------------------------------------------------
DELETE FROM activity_logs;
DELETE FROM employee_status_history;
DELETE FROM status_history;
DELETE FROM documents;
DELETE FROM notifications;

-- إن ظهر خطأ "Table doesn't exist" احذف السطر التالي أو أنشئ الجدول أولاً
DELETE FROM connected_devices;

-- ---------------------------------------------------------------------------
-- 2) سكن (من الأبناء إلى الآباء)
-- ---------------------------------------------------------------------------
DELETE FROM housing_installments;
DELETE FROM housing_custom_fields;
DELETE FROM housing_occupants;
DELETE FROM housing_units;

-- ---------------------------------------------------------------------------
-- 3) أفرع: تراخيص، إيجارات، منشآت، حقول مخصصة، ربط أصحاب عمل
-- ---------------------------------------------------------------------------
DELETE FROM lease_installments;
DELETE FROM branch_leases;
DELETE FROM branch_licenses;
DELETE FROM branch_establishments;
DELETE FROM branch_custom_fields;
DELETE FROM branch_employers;

-- ---------------------------------------------------------------------------
-- 4) مركبات وهواتف وأصحاب عمل
-- ---------------------------------------------------------------------------
DELETE FROM vehicle_custom_fields;
DELETE FROM vehicles;

UPDATE employers SET primaryPhoneId = NULL;
DELETE FROM phones;
DELETE FROM employers;

-- ---------------------------------------------------------------------------
-- 5) موظفون آخرون (قبل حذف الفروع والكيانات)
--     لا يُحذف شيء إذا @keep_emp_id غير معروف (تجنب حذف الجميع بالخطأ).
-- ---------------------------------------------------------------------------
DELETE FROM employees WHERE @keep_emp_id IS NOT NULL AND id <> @keep_emp_id;

-- ---------------------------------------------------------------------------
-- 6) ضريبة وكيانات وأفرع
--     يجب فك ارتباط الموظف المحفوظ بالفروع/الكيان قبل حذفها (حتى مع تعطيل FK).
-- ---------------------------------------------------------------------------
UPDATE employees SET
  workBranchId = NULL,
  contractBranchId = NULL,
  legalEntityId = NULL,
  loanBranchId = NULL,
  establishmentId = NULL
WHERE id = @keep_emp_id;

DELETE FROM tax_payments;
DELETE FROM tax_entity_branches;
DELETE FROM entities;
DELETE FROM branches;

-- ---------------------------------------------------------------------------
-- 7) مستخدمون آخرون (صلاحيات المستخدم تُحذف تلقائياً CASCADE إن وُجدت)
--     لا يُحذف شيء إذا @keep_user_id غير معروف.
-- ---------------------------------------------------------------------------
DELETE FROM users WHERE @keep_user_id IS NOT NULL AND id <> @keep_user_id;

-- إن بقي مستخدم واحد فقط، امسح صلاحياته اليدوية الزائدة إن أردت إعادة تعيين لاحقاً:
-- DELETE FROM user_permissions WHERE userId = @keep_user_id;

-- ---------------------------------------------------------------------------
-- 8) إعدادات عامة في القاعدة (اختياري — يفرّغ مفاتيح النظام المخزنة في MySQL)
--     علّق السطرين التاليين إن كنت تخزن إعدادات حرجة هنا وتريد الإبقاء عليها.
-- ---------------------------------------------------------------------------
DELETE FROM settings;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- 9) تفريغ بيانات الموظف RME0001 ما عدا الاسم والرمز
-- ---------------------------------------------------------------------------
UPDATE employees SET
  imagePath = NULL,
  phone = NULL,
  email = NULL,
  nationality = NULL,
  passportNumber = NULL,
  passportIssueDate = NULL,
  passportExpiry = NULL,
  passportCountry = NULL,
  profession = NULL,
  contractType = NULL,
  contractStartDate = NULL,
  contractExpiryDate = NULL,
  workLicense = NULL,
  workCardNumber = NULL,
  workCardExpiry = NULL,
  contractBranchId = NULL,
  workBranchId = NULL,
  legalEntityId = NULL,
  establishmentId = NULL,
  emiratesId = NULL,
  emiratesIdIssueDate = NULL,
  emiratesIdExpiry = NULL,
  issueEmirate = NULL,
  employerName = NULL,
  establishmentNumber = NULL,
  immigrationEstablishmentNumber = NULL,
  professionKeys = NULL,
  professionCustomTitle = NULL,
  professionPerContract = NULL,
  healthInsuranceEnabled = 0,
  healthInsuranceProvider = NULL,
  healthInsuranceIssueDate = NULL,
  healthInsuranceExpiryDate = NULL,
  unemploymentInsuranceEnabled = NULL,
  unemploymentInsuranceProvider = NULL,
  unemploymentInsuranceIssueDate = NULL,
  unemploymentInsuranceExpiryDate = NULL,
  loanType = NULL,
  targetEntityName = NULL,
  loanExpiryDate = NULL,
  tempContractNumber = NULL,
  loanSalary = NULL,
  loanBranchId = NULL,
  loanProfession = NULL,
  loanSubStatus = NULL,
  loanLeaveStartDate = NULL,
  loanLeaveEndDate = NULL,
  basicSalary = NULL,
  housingAllowance = NULL,
  transportAllowance = NULL,
  otherAllowances = NULL,
  totalSalary = NULL,
  actualSalary = NULL,
  status = 'active',
  notes = NULL,
  updatedAt = CURRENT_TIMESTAMP
WHERE id = @keep_emp_id;

-- ---------------------------------------------------------------------------
-- 10) تنظيف خفيف لحساب المستخدم (الإبقاء على username و passwordHash و roleId و fullName)
-- ---------------------------------------------------------------------------
UPDATE users SET
  email = NULL,
  avatarPath = NULL,
  linkedEntityType = 'employee',
  linkedEntityId = @keep_emp_id,
  updatedAt = CURRENT_TIMESTAMP
WHERE id = @keep_user_id;

-- مزامنة اسم العرض مع اسم الموظف (اختياري)
UPDATE users u
INNER JOIN employees e ON e.id = @keep_emp_id
SET u.fullName = e.name
WHERE u.id = @keep_user_id;

-- =============================================================================
-- تحقق بعد التنفيذ:
--   SELECT id, code, name FROM employees;
--   SELECT id, username, fullName, linkedEntityType, linkedEntityId FROM users;
--   SELECT COUNT(*) FROM branches;
--   SELECT COUNT(*) FROM activity_logs;
-- =============================================================================
