import type { TFunction } from 'i18next';

/**
 * Shared MODULE_KEYS — single source of truth for module → i18n label mapping.
 * Used by RolesSettings, UserPermissionsSettings, and PermissionTree.
 */
export const MODULE_KEYS: Record<string, string> = {
  employees: 'nav.employees',
  branches: 'nav.branchesShort',
  housing: 'nav.housing',
  vehicles: 'nav.vehicles',
  employers: 'nav.employers',
  phones: 'nav.phones',
  entities: 'nav.taxes',
  documents: 'nav.documents',
  settings: 'nav.settings',
  users: 'nav.users',
  logs: 'nav.systemLog',
  devices: 'settings.connectedDevices',
};

/** Display order for modules in the permission tree */
export const MODULE_DISPLAY_ORDER: string[] = [
  'employees',
  'branches',
  'housing',
  'vehicles',
  'employers',
  'phones',
  'entities',
  'documents',
  'settings',
  'users',
  'logs',
  'devices',
];

/** تسمية عرض لـ permissions.action (متوافقة مع UserPermissionsSettings) */
export function humanizePermissionAction(t: TFunction, action: string): string {
  if (action === 'section.visible') {
    return t('common.sectionVisible', 'إظهار / إخفاء القسم');
  }
  if (action.startsWith('action.')) {
    const key = action.slice('action.'.length);
    return t(`common.action.${key}`, action);
  }
  if (action.startsWith('tab.')) {
    const parts = action.split('.');
    const key = parts[1] || action;
    return `${t('common.tabLabel', 'تبويب')}: ${t(`common.tab.${key}`, action)}`;
  }
  if (action.startsWith('field.')) {
    const parts = action.split('.');
    const fieldKey = parts[1] || action;
    const modeKey = parts[2] || 'view';
    const modeLabel = t(`common.${modeKey}`, modeKey);
    return `${t(`common.field.${fieldKey}`, action)} — ${modeLabel}`;
  }
  return t(`common.${action}`, action);
}

// ─── Permission Tree Types ───────────────────────────────────────────────────

export type PermissionCategoryId = 'section' | 'core' | 'tabs' | 'actions' | 'fields';

export interface PermissionCategory {
  id: PermissionCategoryId;
  titleKey: string;
  titleDefault: string;
  match: (action: string) => boolean;
}

/** Category definitions for grouping permissions within a module */
const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'section',
    titleKey: 'settings.permGroupSection',
    titleDefault: 'ظهور القسم',
    match: (a) => a === 'section.visible',
  },
  {
    id: 'core',
    titleKey: 'settings.permGroupCore',
    titleDefault: 'أساسي',
    match: (a) => !a.includes('.') && ['view', 'create', 'edit', 'archive', 'delete', 'manage'].includes(a),
  },
  {
    id: 'tabs',
    titleKey: 'settings.permGroupTabs',
    titleDefault: 'تبويبات',
    match: (a) => a.startsWith('tab.'),
  },
  {
    id: 'actions',
    titleKey: 'settings.permGroupActions',
    titleDefault: 'إجراءات حساسة',
    match: (a) => a.startsWith('action.'),
  },
  {
    id: 'fields',
    titleKey: 'settings.permGroupFields',
    titleDefault: 'حقول العرض والتعديل',
    match: (a) => a.startsWith('field.'),
  },
];

export interface PermissionItem {
  id: number;
  module: string;
  action: string;
}

export interface PermissionCategoryNode {
  category: PermissionCategory;
  permissions: PermissionItem[];
}

export interface PermissionModuleNode {
  module: string;
  moduleLabel: string;
  categories: PermissionCategoryNode[];
  /** true if the module has granular permissions (tabs/fields/actions) beyond core CRUD */
  hasGranular: boolean;
}

/**
 * Build a hierarchical tree of permissions grouped by module → category.
 * This is the primary data structure used by PermissionTree component.
 */
export function buildPermissionTree(
  permissions: PermissionItem[],
  t: TFunction
): PermissionModuleNode[] {
  // Group by module (and deduplicate if DB has corrupted/duplicate records)
  const byModule = new Map<string, PermissionItem[]>();
  const seenUnique = new Set<string>();

  for (const p of permissions) {
    const uniqueKey = `${p.module}:${p.action}`;
    if (seenUnique.has(uniqueKey)) continue;
    seenUnique.add(uniqueKey);

    const list = byModule.get(p.module) ?? [];
    list.push(p);
    byModule.set(p.module, list);
  }

  // Build tree in display order
  const tree: PermissionModuleNode[] = [];
  const seen = new Set<string>();

  for (const mod of MODULE_DISPLAY_ORDER) {
    const items = byModule.get(mod);
    if (!items?.length) continue;
    seen.add(mod);
    tree.push(buildModuleNode(mod, items, t));
  }

  // Any remaining modules not in display order
  for (const [mod, items] of byModule) {
    if (seen.has(mod)) continue;
    tree.push(buildModuleNode(mod, items, t));
  }

  return tree;
}

function buildModuleNode(
  module: string,
  items: PermissionItem[],
  t: TFunction
): PermissionModuleNode {
  const categories: PermissionCategoryNode[] = [];
  const used = new Set<number>();

  for (const cat of PERMISSION_CATEGORIES) {
    const catPerms = items
      .filter((p) => cat.match(p.action))
      .sort((a, b) => a.action.localeCompare(b.action));
    if (!catPerms.length) continue;
    for (const p of catPerms) used.add(p.id);
    categories.push({ category: cat, permissions: catPerms });
  }

  // Any uncategorized permissions
  const rest = items.filter((p) => !used.has(p.id)).sort((a, b) => a.action.localeCompare(b.action));
  if (rest.length) {
    categories.push({
      category: {
        id: 'core' as PermissionCategoryId,
        titleKey: 'settings.permGroupOther',
        titleDefault: 'أخرى',
        match: () => true,
      },
      permissions: rest,
    });
  }

  const hasGranular = categories.some((c) => c.category.id !== 'core' && c.category.id !== 'section');
  const moduleLabel = t(MODULE_KEYS[module] ?? module, module);

  return { module, moduleLabel, categories, hasGranular };
}

/**
 * Filter permission tree by search query.
 * Matches against module label, category label, and permission action label.
 */
export function filterPermissionTree(
  tree: PermissionModuleNode[],
  query: string,
  t: TFunction
): PermissionModuleNode[] {
  if (!query.trim()) return tree;
  const q = query.trim().toLowerCase();

  return tree
    .map((mod) => {
      // Check if module name matches
      if (mod.moduleLabel.toLowerCase().includes(q)) return mod;

      // Filter categories/permissions
      const filteredCats = mod.categories
        .map((cat) => {
          const catLabel = t(cat.category.titleKey, cat.category.titleDefault).toLowerCase();
          if (catLabel.includes(q)) return cat;

          const filteredPerms = cat.permissions.filter((p) => {
            const actionLabel = humanizePermissionAction(t, p.action).toLowerCase();
            return actionLabel.includes(q) || p.action.toLowerCase().includes(q);
          });

          if (!filteredPerms.length) return null;
          return { ...cat, permissions: filteredPerms };
        })
        .filter(Boolean) as PermissionCategoryNode[];

      if (!filteredCats.length) return null;
      return { ...mod, categories: filteredCats };
    })
    .filter(Boolean) as PermissionModuleNode[];
}

// ─── Legacy Exports (backward compat) ────────────────────────────────────────

export type EmployeesPermissionGroup = {
  id: string;
  titleKey: string;
  titleDefault: string;
  match: (action: string) => boolean;
};

/** ترتيب عرض مجموعات صلاحيات الموظفين في الإعدادات */
export const EMPLOYEES_PERMISSION_UI_GROUPS: EmployeesPermissionGroup[] = [
  {
    id: 'core',
    titleKey: 'settings.permGroupEmployeesCore',
    titleDefault: 'الموظفين — أساسي',
    match: (a) => !a.includes('.') && ['view', 'create', 'edit', 'archive', 'delete', 'manage'].includes(a),
  },
  {
    id: 'tabs',
    titleKey: 'settings.permGroupEmployeesTabs',
    titleDefault: 'الموظفين — تبويبات الملف',
    match: (a) => a.startsWith('tab.'),
  },
  {
    id: 'actions',
    titleKey: 'settings.permGroupEmployeesActions',
    titleDefault: 'الموظفين — إجراءات حساسة',
    match: (a) => a.startsWith('action.'),
  },
  {
    id: 'fields',
    titleKey: 'settings.permGroupEmployeesFields',
    titleDefault: 'الموظفين — حقول العرض والتعديل',
    match: (a) => a.startsWith('field.'),
  },
];

export function employeesPermissionGroupId(action: string): string {
  const g = EMPLOYEES_PERMISSION_UI_GROUPS.find((x) => x.match(action));
  return g?.id ?? 'other';
}

export type SettingsPermissionRow =
  | { kind: 'section'; key: string; label: string }
  | { kind: 'permission'; permission: { id: number; module: string; action: string } };

/** صفوف مجمّعة لصلاحيات الموظفين ثم بقية الوحدات (بدون عناوين بين الوحدات). */
export function buildSettingsPermissionTableRows(
  permissions: { id: number; module: string; action: string }[],
  t: TFunction
): SettingsPermissionRow[] {
  const emp = permissions.filter((p) => p.module === 'employees');
  const other = permissions
    .filter((p) => p.module !== 'employees')
    .sort((a, b) => a.module.localeCompare(b.module) || a.action.localeCompare(b.action));

  const out: SettingsPermissionRow[] = [];
  const used = new Set<number>();

  for (const g of EMPLOYEES_PERMISSION_UI_GROUPS) {
    const list = emp.filter((p) => g.match(p.action)).sort((a, b) => a.action.localeCompare(b.action));
    if (!list.length) continue;
    out.push({ kind: 'section', key: `emp-sec-${g.id}`, label: t(g.titleKey, g.titleDefault) });
    for (const p of list) {
      used.add(p.id);
      out.push({ kind: 'permission', permission: p });
    }
  }
  const empRest = emp.filter((p) => !used.has(p.id)).sort((a, b) => a.action.localeCompare(b.action));
  if (empRest.length) {
    out.push({
      kind: 'section',
      key: 'emp-sec-other',
      label: t('settings.permGroupEmployeesOther', 'موظفين — أخرى'),
    });
    for (const p of empRest) out.push({ kind: 'permission', permission: p });
  }

  for (const p of other) out.push({ kind: 'permission', permission: p });
  return out;
}
