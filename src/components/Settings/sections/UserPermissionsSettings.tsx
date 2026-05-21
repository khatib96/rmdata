import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Save, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { clearPermissionsCache } from '../../../services/permissionsService';
import { PERMISSION_CATALOG_V2, ALL_MODULES } from '../../../permissions/permissionCatalogV2';

// ─── Types ──────────────────────────────────────────────────────
interface UserRow {
  id: number;
  username: string;
  fullName: string;
  roleId: number;
  isActive: number;
}

interface PermissionRow {
  id: number;
  module: string;
  action: string;
}

// ─── Permission Group Definitions ────────────────────────────────
interface PermGroup {
  key: string;
  labelKey: string;
  actions: string[];
}

function getGroupsForModule(module: string): PermGroup[] {
  const catalogActions = PERMISSION_CATALOG_V2
    .filter((p) => p.module === module)
    .map((p) => p.action);

  const groups: PermGroup[] = [];

  // Section (CRUD)
  const crudActions = catalogActions.filter(
    (a) => ['section.visible', 'view', 'create', 'edit', 'delete', 'archive'].includes(a)
  );
  if (crudActions.length > 0) {
    groups.push({ key: 'section', labelKey: 'permissions.groupSection', actions: crudActions });
  }

  // Tabs
  const tabActions = catalogActions.filter((a) => a.startsWith('tab.'));
  if (tabActions.length > 0) {
    groups.push({ key: 'tabs', labelKey: 'permissions.groupTabs', actions: tabActions });
  }

  // Sub-sections (settings)
  const subActions = catalogActions.filter((a) => a.startsWith('sub.'));
  if (subActions.length > 0) {
    groups.push({ key: 'subs', labelKey: 'permissions.groupSubSections', actions: subActions });
  }

  // Fields
  const fieldActions = catalogActions.filter((a) => a.startsWith('field.'));
  if (fieldActions.length > 0) {
    groups.push({ key: 'fields', labelKey: 'permissions.groupFields', actions: fieldActions });
  }

  // User management (settings module)
  const usersActions = catalogActions.filter((a) => a.startsWith('users.'));
  if (usersActions.length > 0) {
    groups.push({ key: 'users', labelKey: 'permissions.groupUsers', actions: usersActions });
  }

  // Actions
  const actionActions = catalogActions.filter((a) => a.startsWith('action.'));
  if (actionActions.length > 0) {
    groups.push({ key: 'actions', labelKey: 'permissions.groupActions', actions: actionActions });
  }

  return groups;
}

// ─── Module labels ────────────────────────────────────────────────
const MODULE_LABELS: Record<string, string> = {
  employees: 'الموظفون',
  branches: 'الأفرع',
  housing: 'السكن',
  vehicles: 'المركبات',
  employers: 'أصحاب العمل',
  phones: 'الهواتف',
  entities: 'المنشآت',
  documents: 'المستندات',
  settings: 'الإعدادات',
  logs: 'السجلات',
};

const ACTION_LABELS: Record<string, string> = {
  'section.visible': 'إظهار القسم',
  'view': 'عرض',
  'create': 'إنشاء',
  'edit': 'تعديل',
  'delete': 'حذف',
  'archive': 'أرشفة',
  // Tabs
  'tab.basic': 'البيانات الأساسية',
  'tab.passport': 'الجواز',
  'tab.contract': 'العقد',
  'tab.residency': 'الإقامة',
  'tab.insurances': 'التأمينات',
  'tab.workStatus': 'حالة العمل',
  'tab.phones': 'الهواتف',
  'tab.history': 'السجل',
  'tab.documents': 'المستندات',
  'tab.licenses': 'التراخيص',
  'tab.entity': 'المنشأة',
  'tab.employees': 'الموظفون',
  'tab.employers': 'أصحاب العمل',
  'tab.occupants': 'الشاغلون',
  'tab.permits': 'التصاريح',
  'tab.passportResidency': 'الجواز والإقامة',
  'tab.branches': 'الأفرع',
  'tab.docs': 'المستندات',
  'tab.main': 'البيانات الرئيسية',
  'tab.vat': 'ضريبة القيمة المضافة',
  'tab.corporate': 'ضريبة الشركات',
  'tab.summary': 'ملخص الضرائب',
  // Fields
  'field.nationality': 'الجنسية',
  'field.email': 'البريد الإلكتروني',
  'field.phone': 'رقم الهاتف',
  'field.profilePhoto': 'صورة الملف الشخصي',
  'field.passportNo': 'رقم الجواز',
  'field.passportExpiry': 'انتهاء الجواز',
  'field.nationalId': 'الهوية الوطنية',
  'field.emiratesIdExpiry': 'انتهاء الهوية',
  'field.salary': 'الراتب والبدلات',
  'field.actualSalary': 'الراتب الفعلي',
  'field.contractDetails': 'تفاصيل العقد',
  'field.contractAllowances': 'بدلات العقد',
  'field.insuranceHealth': 'التأمين الصحي',
  'field.insuranceUnemployment': 'تأمين التعطل',
  'field.workBranch': 'فرع العمل',
  'field.profession': 'المهنة',
  'field.loanDetails': 'تفاصيل الإعارة',
  'field.documentsLegal': 'المستندات القانونية',
  'field.documentsFinancial': 'المستندات المالية',
  'field.branchType': 'نوع الفرع',
  'field.location': 'الموقع',
  'field.contact': 'بيانات الاتصال',
  'field.photo': 'صورة الفرع',
  'field.address': 'العنوان',
  'field.mapLink': 'رابط الخريطة',
  'field.workSchedule': 'جدول العمل',
  'field.linkedBranch': 'الفرع المرتبط',
  'field.tradeLicense': 'الرخصة التجارية',
  'field.leaseContract': 'عقد الإيجار',
  'field.leaseAmount': 'مبلغ الإيجار',
  'field.leaseSchedule': 'جدول الدفعات',
  'field.taxIdentifiers': 'المعرفات الضريبية',
  'field.entityInfo': 'معلومات المنشأة',
  'field.employeeList': 'قائمة الموظفين',
  'field.salaryInEmployeeTab': 'الراتب في تبويب الموظفين',
  'field.employerList': 'قائمة أصحاب العمل',
  'field.employerOwnership': 'نسبة الملكية',
  'field.contractAmount': 'مبلغ العقد',
  'field.installments': 'الأقساط',
  'field.occupantsList': 'قائمة الشاغلين',
  'field.insuranceDetails': 'تفاصيل التأمين',
  'field.licenseDetails': 'تفاصيل الرخصة',
  'field.permitDetails': 'تفاصيل التصريح',
  'field.passportDetails': 'تفاصيل الجواز',
  'field.emiratesId': 'بطاقة الهوية',
  'field.branchLinks': 'ربط الأفرع',
  'field.ownershipPercent': 'نسبة الملكية',
  'field.simDetails': 'تفاصيل الشريحة',
  'field.assignedTo': 'مسند إلى',
  'field.financialYear': 'السنة المالية',
  'field.taxPayments': 'الدفعات الضريبية',
  'field.taxSummary': 'ملخص الضرائب',
  // Actions
  'action.changeStatus': 'تغيير الحالة',
  'action.transferBranch': 'نقل الفرع',
  'action.uploadDocs': 'رفع مستندات',
  'action.deleteDocs': 'حذف مستندات',
  'action.exportData': 'تصدير البيانات',
  // Sub-sections
  'sub.general': 'الإعدادات العامة',
  'sub.language': 'اللغة',
  'sub.users': 'المستخدمون',
  'sub.permissions': 'الصلاحيات',
  'sub.notifications': 'الإشعارات',
  'sub.database': 'قاعدة البيانات',
  'sub.devices': 'الأجهزة المتصلة',
  'sub.backup': 'النسخ الاحتياطي',
  // User management
  'users.view': 'عرض المستخدمين',
  'users.create': 'إنشاء مستخدم',
  'users.edit': 'تعديل مستخدم',
  'users.delete': 'حذف مستخدم',
};

// ─── Component ────────────────────────────────────────────────────

export default function UserPermissionsSettings() {
  const { t } = useTranslation();
  const authUser = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const isAdmin = authUser?.roleId === 1;

  const [users, setUsers] = useState<UserRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [grantedIds, setGrantedIds] = useState<Set<number>>(new Set());
  const [initialGrantedIds, setInitialGrantedIds] = useState<Set<number>>(new Set());
  const [activeModule, setActiveModule] = useState(ALL_MODULES[0]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) ?? null, [users, selectedUserId]);

  const dirty = useMemo(() => {
    if (grantedIds.size !== initialGrantedIds.size) return true;
    for (const v of grantedIds) if (!initialGrantedIds.has(v)) return true;
    return false;
  }, [grantedIds, initialGrantedIds]);

  // ─── Permission ID lookup ───────────────────────────────────
  const permIdMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of permissions) map.set(`${p.module}:${p.action}`, p.id);
    return map;
  }, [permissions]);

  // ─── Load users + permissions catalog ────────────────────────
  useEffect(() => {
    if (!window.electronAPI?.dbQuery) { setLoading(false); return; }
    setLoading(true);

    Promise.all([
      window.electronAPI.dbQuery(
        `SELECT u.id, u.username, u.fullName, u.roleId, u.isActive FROM users u ORDER BY u.username`
      ),
      window.electronAPI.dbQuery('SELECT id, module, action FROM permissions ORDER BY module, action'),
    ]).then(([uRes, pRes]) => {
      const rawUsers = (uRes?.data ?? []) as UserRow[];
      // Admin sees all users, non-admin sees only self
      const u = isAdmin ? rawUsers : rawUsers.filter((row) => row.id === authUser?.id);
      const p = (pRes?.data ?? []) as PermissionRow[];
      setUsers(u);
      setPermissions(p);

      // Default to first non-admin user, or first user
      const nonAdmin = u.find((x) => x.roleId !== 1);
      setSelectedUserId(nonAdmin?.id ?? u[0]?.id ?? null);
    }).finally(() => setLoading(false));
  }, [isAdmin, authUser?.id]);

  // ─── Load selected user's permissions ────────────────────────
  useEffect(() => {
    if (selectedUserId == null) return;
    const api = window.electronAPI;
    if (!api?.permissionsGetUserPermissions && !api?.dbQuery) return;
    setLoading(true);

    const loadPromise = api.permissionsGetUserPermissions
      ? api.permissionsGetUserPermissions(sessionToken, selectedUserId)
      : api.dbQuery(
          'SELECT permissionId FROM user_permissions WHERE userId = ?',
          [selectedUserId]
        );

    loadPromise.then((res) => {
      const ids = new Set(((res?.data ?? []) as { permissionId: number }[]).map((x) => x.permissionId));
      setGrantedIds(ids);
      setInitialGrantedIds(new Set(ids));
    }).finally(() => setLoading(false));
  }, [selectedUserId, sessionToken]);

  // ─── Toggle single permission ────────────────────────────────
  const toggle = useCallback((permId: number) => {
    setGrantedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  }, []);

  // ─── Toggle all in a group ───────────────────────────────────
  const toggleGroup = useCallback((actions: string[]) => {
    setGrantedIds((prev) => {
      const next = new Set(prev);
      const ids = actions.map((a) => permIdMap.get(`${activeModule}:${a}`)).filter(Boolean) as number[];
      const allGranted = ids.every((id) => next.has(id));
      if (allGranted) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }, [activeModule, permIdMap]);

  // ─── Toggle all for module ───────────────────────────────────
  const toggleAllModule = useCallback(() => {
    setGrantedIds((prev) => {
      const next = new Set(prev);
      const moduleActions = PERMISSION_CATALOG_V2.filter((p) => p.module === activeModule);
      const ids = moduleActions.map((a) => permIdMap.get(`${a.module}:${a.action}`)).filter(Boolean) as number[];
      const allGranted = ids.every((id) => next.has(id));
      if (allGranted) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }, [activeModule, permIdMap]);

  // ─── Collapse/expand group ───────────────────────────────────
  const toggleCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  // ─── Save ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedUserId) return;
    const api = window.electronAPI;
    if (!api?.permissionsSetUserPermissions && !api?.dbQuery) return;
    setSaving(true);
    try {
      if (api.permissionsSetUserPermissions) {
        const res = await api.permissionsSetUserPermissions(sessionToken, selectedUserId, Array.from(grantedIds));
        if (!res?.success) throw new Error(res?.error || 'PERMISSIONS_SAVE_FAILED');
      } else {
        // Legacy fallback for old preload builds only. New builds use permissionsSetUserPermissions.
        await api.dbQuery('DELETE FROM user_permissions WHERE userId = ?', [selectedUserId]);
        for (const id of grantedIds) {
          await api.dbQuery(
            'INSERT OR IGNORE INTO user_permissions (userId, permissionId) VALUES (?, ?)',
            [selectedUserId, id]
          );
        }
      }

      setInitialGrantedIds(new Set(grantedIds));
      clearPermissionsCache();
      window.dispatchEvent(new CustomEvent('permissions-changed'));
      toast.success(t('settings.permissionsSaved') || 'تم حفظ الصلاحيات بنجاح');
    } catch (err) {
      console.error('Save permissions failed:', err);
      toast.error(t('settings.permissionsSaveError') || 'خطأ في حفظ الصلاحيات');
    } finally {
      setSaving(false);
    }
  };

  // ─── Groups for active module ────────────────────────────────
  const groups = useMemo(() => getGroupsForModule(activeModule), [activeModule]);

  // Admin user is selected (roleId=1)
  const isAdminSelected = selectedUser?.roleId === 1;

  if (loading && users.length === 0) {
    return <div className="text-center py-8 text-secondary-gray">{t('common.loading') || 'جاري التحميل...'}</div>;
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-dark-charcoal">🔑 صلاحيات المستخدم</h2>
        <div className="flex items-center gap-3">
          {/* User selector */}
          <select
            className="px-3 py-2 rounded-lg border border-secondary-gray bg-white text-sm min-w-[200px]"
            value={selectedUserId ?? ''}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
          >
            <option value="" disabled>اختر المستخدم</option>
            {users.filter((u) => u.roleId !== 1).map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.username})
              </option>
            ))}
          </select>

          {/* Save button */}
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              dirty
                ? 'bg-primary-gold text-white hover:bg-primary-gold/90 shadow-md'
                : 'bg-secondary-gray/30 text-secondary-gray cursor-not-allowed'
            }`}
          >
            <Save size={16} />
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      {/* Admin warning */}
      {isAdminSelected && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
          ⚠️ Admin يملك كل الصلاحيات تلقائياً — لا يمكن تعديل صلاحياته.
        </div>
      )}

      {selectedUser && !isAdminSelected && (
        <>
          {/* Module tabs */}
          <div className="flex flex-wrap gap-1.5 bg-white rounded-xl border border-secondary-gray/50 p-2 shadow-sm">
            {ALL_MODULES.map((mod) => {
              const isActive = activeModule === mod;
              const modulePerms = PERMISSION_CATALOG_V2.filter((p) => p.module === mod);
              const grantedCount = modulePerms.filter(
                (p) => grantedIds.has(permIdMap.get(`${p.module}:${p.action}`) ?? -1)
              ).length;
              const total = modulePerms.length;

              return (
                <button
                  key={mod}
                  type="button"
                  onClick={() => { setActiveModule(mod); setCollapsedGroups(new Set()); }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all relative ${
                    isActive
                      ? 'bg-primary-gold text-white shadow-md'
                      : 'text-dark-charcoal hover:bg-primary-gold/10'
                  }`}
                >
                  {MODULE_LABELS[mod] || mod}
                  {grantedCount > 0 && (
                    <span className={`mr-1.5 text-xs ${isActive ? 'text-white/80' : 'text-primary-gold'}`}>
                      ({grantedCount}/{total})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Toggle all for module */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-dark-charcoal">{MODULE_LABELS[activeModule]}</h3>
            <button
              type="button"
              onClick={toggleAllModule}
              className="text-xs px-3 py-1.5 rounded-lg border border-primary-gold text-primary-gold hover:bg-primary-gold/10 transition-colors"
            >
              {PERMISSION_CATALOG_V2.filter((p) => p.module === activeModule).every(
                (p) => grantedIds.has(permIdMap.get(`${p.module}:${p.action}`) ?? -1)
              )
                ? '❌ إلغاء الكل'
                : '✅ تفعيل الكل'}
            </button>
          </div>

          {/* Permission groups */}
          <div className="space-y-3">
            {groups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.key);
              const ids = group.actions.map((a) => permIdMap.get(`${activeModule}:${a}`)).filter(Boolean) as number[];
              const allGranted = ids.length > 0 && ids.every((id) => grantedIds.has(id));

              return (
                <div key={group.key} className="bg-white rounded-xl border border-secondary-gray/40 shadow-sm overflow-hidden">
                  {/* Group header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-primary-gold/5 to-transparent cursor-pointer select-none"
                    onClick={() => toggleCollapse(group.key)}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      <span className="font-semibold text-sm text-dark-charcoal">
                        {group.key === 'section' ? 'القسم' :
                         group.key === 'tabs' ? 'التبويبات' :
                         group.key === 'fields' ? 'الحقول' :
                         group.key === 'actions' ? 'العمليات' :
                         group.key === 'subs' ? 'الأقسام الفرعية' :
                         group.key === 'users' ? 'إدارة المستخدمين' :
                         group.key}
                      </span>
                      <span className="text-xs text-secondary-gray">
                        ({ids.filter((id) => grantedIds.has(id)).length}/{ids.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleGroup(group.actions); }}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        allGranted
                          ? 'border-red-300 text-red-600 hover:bg-red-50'
                          : 'border-green-300 text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {allGranted ? 'إلغاء الكل' : 'تفعيل الكل'}
                    </button>
                  </div>

                  {/* Group content (table) */}
                  {!isCollapsed && (
                    <div className="border-t border-secondary-gray/20">
                      <table className="w-full text-sm">
                        <tbody>
                          {group.actions.map((action) => {
                            const key = `${activeModule}:${action}`;
                            const permId = permIdMap.get(key);
                            if (!permId) return null;
                            const granted = grantedIds.has(permId);

                            return (
                              <tr
                                key={action}
                                className="border-b border-secondary-gray/10 last:border-0 hover:bg-primary-gold/3 transition-colors"
                              >
                                <td className="px-4 py-2.5 font-medium text-dark-charcoal">
                                  {ACTION_LABELS[action] || action}
                                </td>
                                <td className="px-4 py-2.5 text-left w-16">
                                  <button
                                    type="button"
                                    onClick={() => toggle(permId)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                      granted
                                        ? 'bg-primary-gold text-white shadow-sm'
                                        : 'bg-secondary-gray/15 text-secondary-gray hover:bg-secondary-gray/25'
                                    }`}
                                  >
                                    {granted ? <Check size={16} /> : <X size={14} />}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
