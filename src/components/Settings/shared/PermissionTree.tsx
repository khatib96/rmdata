import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, Search, Shield, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import {
  buildPermissionTree,
  filterPermissionTree,
  humanizePermissionAction,
  type PermissionModuleNode,
  type PermissionCategoryNode,
  type PermissionItem,
} from '../../../utils/permissionLabels';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PermissionState = 'granted' | 'denied' | 'extra' | 'none';

export interface PermissionTreeProps {
  permissions: PermissionItem[];
  /** For roles mode: multiple role columns */
  mode: 'roles' | 'user';
  // ── Roles mode props ──
  /** Role columns (excluding Admin) */
  roles?: { id: number; name: string }[];
  /** Check if a role has a permission */
  hasRolePermission?: (roleId: number, permissionId: number) => boolean;
  /** Toggle a role's permission */
  onToggleRolePermission?: (roleId: number, permissionId: number) => void;
  /** Bulk toggle: set multiple permissions for a role at once */
  onBulkSetRolePermissions?: (roleId: number, permissionIds: number[], grant: boolean) => void;
  // ── User mode props ──
  /** Current user's role-based permissions (read-only display) */
  rolePermissionIds?: Set<number>;
  /** Extra user-level permissions */
  extraPermissionIds?: Set<number>;
  /** Denied (overridden) permissions */
  denyPermissionIds?: Set<number>;
  /** Toggle permission for user */
  onToggleUserPermission?: (permissionId: number) => void;
  /** Bulk toggle: set multiple permissions for user at once */
  onBulkToggleUserPermissions?: (permissionIds: number[], grant: boolean) => void;
  /** Active filter for user mode */
  userFilter?: 'all' | 'granted' | 'denied' | 'extra';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PermissionTree({
  permissions,
  mode,
  roles,
  hasRolePermission,
  onToggleRolePermission,
  onBulkSetRolePermissions,
  rolePermissionIds,
  extraPermissionIds,
  denyPermissionIds,
  onToggleUserPermission,
  onBulkToggleUserPermissions,
  userFilter = 'all',
}: PermissionTreeProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildPermissionTree(permissions, t), [permissions, t]);
  const filteredTree = useMemo(() => filterPermissionTree(tree, search, t), [tree, search, t]);

  // In user mode, further filter by state
  const displayTree = useMemo(() => {
    if (mode !== 'user' || userFilter === 'all') return filteredTree;

    return filteredTree
      .map((mod) => {
        const filteredCats = mod.categories
          .map((cat) => {
            const filteredPerms = cat.permissions.filter((p) => {
              const state = getUserPermState(p.id, rolePermissionIds, extraPermissionIds, denyPermissionIds);
              if (userFilter === 'granted') return state === 'granted' || state === 'extra';
              if (userFilter === 'denied') return state === 'denied';
              if (userFilter === 'extra') return state === 'extra';
              return true;
            });
            if (!filteredPerms.length) return null;
            return { ...cat, permissions: filteredPerms };
          })
          .filter(Boolean) as PermissionCategoryNode[];
        if (!filteredCats.length) return null;
        return { ...mod, categories: filteredCats };
      })
      .filter(Boolean) as PermissionModuleNode[];
  }, [filteredTree, mode, userFilter, rolePermissionIds, extraPermissionIds, denyPermissionIds]);

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isCollapsed = (key: string) => collapsed.has(key);

  const hasSearch = search.trim().length > 0;

  const allPermIds = useMemo(
    () => displayTree.flatMap((m) => m.categories.flatMap((c) => c.permissions.map((p) => p.id))),
    [displayTree]
  );

  return (
    <div className="space-y-3">
      {/* Search bar + global select all */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-gray pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('settings.searchPermissions', 'بحث في الصلاحيات...')}
            className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-secondary-gray/60 bg-white text-dark-charcoal placeholder:text-secondary-gray/60 focus:border-primary-gold focus:ring-1 focus:ring-primary-gold/30 transition-colors"
          />
        </div>
        {/* Global select / deselect */}
        {mode === 'roles' && roles && onBulkSetRolePermissions && (
          <div className="flex gap-1 shrink-0">
            {roles.map((r) => (
              <div key={r.id} className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-dark-charcoal/60 leading-none">{r.name}</span>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => onBulkSetRolePermissions(r.id, allPermIds, true)}
                    title={t('settings.selectAll', 'تحديد الكل')}
                    className="p-1 rounded text-primary-gold hover:bg-primary-gold/10"
                  >
                    <CheckSquare size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkSetRolePermissions(r.id, allPermIds, false)}
                    title={t('settings.deselectAll', 'إلغاء الكل')}
                    className="p-1 rounded text-secondary-gray hover:bg-secondary-gray/10"
                  >
                    <Square size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {mode === 'user' && onBulkToggleUserPermissions && (
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onBulkToggleUserPermissions(allPermIds, true)}
              title={t('settings.selectAll', 'تحديد الكل')}
              className="px-2.5 py-2 rounded-lg text-xs font-medium text-primary-gold border border-primary-gold/30 hover:bg-primary-gold/10 flex items-center gap-1"
            >
              <CheckSquare size={13} /> {t('settings.selectAll', 'تحديد الكل')}
            </button>
            <button
              type="button"
              onClick={() => onBulkToggleUserPermissions(allPermIds, false)}
              title={t('settings.deselectAll', 'إلغاء الكل')}
              className="px-2.5 py-2 rounded-lg text-xs font-medium text-secondary-gray border border-secondary-gray/30 hover:bg-secondary-gray/10 flex items-center gap-1"
            >
              <Square size={13} /> {t('settings.deselectAll', 'إلغاء الكل')}
            </button>
          </div>
        )}
      </div>

      {/* Tree */}
      <div className="border border-secondary-gray/50 rounded-xl overflow-hidden bg-white">
        {displayTree.length === 0 ? (
          <div className="p-8 text-center text-secondary-gray text-sm">
            {search ? t('settings.noPermissionsMatch', 'لا توجد صلاحيات تطابق البحث') : t('settings.noPermissions', 'لا توجد صلاحيات')}
          </div>
        ) : (
          displayTree.map((modNode, modIdx) => (
            <ModuleSection
              key={modNode.module}
              modNode={modNode}
              isFirst={modIdx === 0}
              isCollapsed={!hasSearch && isCollapsed(modNode.module)}
              onToggleCollapse={() => toggleCollapse(modNode.module)}
              forceExpand={hasSearch}
              mode={mode}
              roles={roles}
              hasRolePermission={hasRolePermission}
              onToggleRolePermission={onToggleRolePermission}
              onBulkSetRolePermissions={onBulkSetRolePermissions}
              rolePermissionIds={rolePermissionIds}
              extraPermissionIds={extraPermissionIds}
              denyPermissionIds={denyPermissionIds}
              onToggleUserPermission={onToggleUserPermission}
              onBulkToggleUserPermissions={onBulkToggleUserPermissions}
              t={t}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Indeterminate Checkbox ──────────────────────────────────────────────────

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  className = '',
  title,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  className?: string;
  title?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      title={title}
      className={`w-4 h-4 rounded border-secondary-gray text-primary-gold focus:ring-primary-gold/40 cursor-pointer ${className}`}
    />
  );
}

// ─── Module Section ──────────────────────────────────────────────────────────

interface ModuleSectionProps {
  modNode: PermissionModuleNode;
  isFirst: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  forceExpand: boolean;
  mode: 'roles' | 'user';
  roles?: { id: number; name: string }[];
  hasRolePermission?: (roleId: number, permissionId: number) => boolean;
  onToggleRolePermission?: (roleId: number, permissionId: number) => void;
  onBulkSetRolePermissions?: (roleId: number, permissionIds: number[], grant: boolean) => void;
  rolePermissionIds?: Set<number>;
  extraPermissionIds?: Set<number>;
  denyPermissionIds?: Set<number>;
  onToggleUserPermission?: (permissionId: number) => void;
  onBulkToggleUserPermissions?: (permissionIds: number[], grant: boolean) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function ModuleSection({
  modNode,
  isFirst,
  isCollapsed,
  onToggleCollapse,
  forceExpand,
  mode,
  roles,
  hasRolePermission,
  onToggleRolePermission,
  onBulkSetRolePermissions,
  rolePermissionIds,
  extraPermissionIds,
  denyPermissionIds,
  onToggleUserPermission,
  onBulkToggleUserPermissions,
  t,
}: ModuleSectionProps) {
  const expanded = forceExpand || !isCollapsed;
  const allModulePermIds = useMemo(
    () => modNode.categories.flatMap((c) => c.permissions.map((p) => p.id)),
    [modNode]
  );
  const permCount = allModulePermIds.length;

  return (
    <div className={isFirst ? '' : 'border-t border-secondary-gray/30'}>
      {/* Module header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-l from-primary-gold/5 to-transparent hover:from-primary-gold/10 transition-colors text-right">
        <button type="button" onClick={onToggleCollapse} className="flex items-center gap-2 flex-1 text-right">
          {expanded ? (
            <ChevronDown size={18} className="shrink-0 text-primary-gold transition-transform" />
          ) : (
            <ChevronLeft size={18} className="shrink-0 text-primary-gold transition-transform" />
          )}
          <Shield size={16} className="shrink-0 text-primary-gold/70" />
          <span className="font-bold text-dark-charcoal flex-1 text-right">{modNode.moduleLabel}</span>
          <span className="text-xs text-secondary-gray bg-secondary-gray/10 rounded-full px-2 py-0.5">
            {permCount}
          </span>
        </button>

        {/* Per-module select-all checkboxes */}
        {mode === 'roles' && roles?.map((r) => {
          const grantedCount = allModulePermIds.filter((id) => hasRolePermission?.(r.id, id)).length;
          const allGranted = grantedCount === permCount;
          const someGranted = grantedCount > 0 && !allGranted;
          return (
            <label key={r.id} className="w-16 flex items-center justify-center shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
              <IndeterminateCheckbox
                checked={allGranted}
                indeterminate={someGranted}
                onChange={() => onBulkSetRolePermissions?.(r.id, allModulePermIds, !allGranted)}
                title={allGranted ? t('settings.deselectAll') : t('settings.selectAll')}
              />
            </label>
          );
        })}

        {mode === 'user' && onBulkToggleUserPermissions && (
          <UserModuleCheckbox
            permIds={allModulePermIds}
            rolePermissionIds={rolePermissionIds}
            extraPermissionIds={extraPermissionIds}
            denyPermissionIds={denyPermissionIds}
            onBulkToggle={onBulkToggleUserPermissions}
            t={t}
          />
        )}
      </div>

      {/* Categories + permissions */}
      {expanded && (
        <div className="pb-1">
          {modNode.categories.map((catNode) => (
            <CategorySection
              key={catNode.category.id}
              catNode={catNode}
              hasGranular={modNode.hasGranular}
              mode={mode}
              roles={roles}
              hasRolePermission={hasRolePermission}
              onToggleRolePermission={onToggleRolePermission}
              rolePermissionIds={rolePermissionIds}
              extraPermissionIds={extraPermissionIds}
              denyPermissionIds={denyPermissionIds}
              onToggleUserPermission={onToggleUserPermission}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── User Module Checkbox ────────────────────────────────────────────────────

function UserModuleCheckbox({
  permIds,
  rolePermissionIds,
  extraPermissionIds,
  denyPermissionIds,
  onBulkToggle,
  t,
}: {
  permIds: number[];
  rolePermissionIds?: Set<number>;
  extraPermissionIds?: Set<number>;
  denyPermissionIds?: Set<number>;
  onBulkToggle: (ids: number[], grant: boolean) => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const grantedCount = permIds.filter((id) => {
    const state = getUserPermState(id, rolePermissionIds, extraPermissionIds, denyPermissionIds);
    return state === 'granted' || state === 'extra';
  }).length;
  const allGranted = grantedCount === permIds.length;
  const someGranted = grantedCount > 0 && !allGranted;

  return (
    <label className="shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
      <IndeterminateCheckbox
        checked={allGranted}
        indeterminate={someGranted}
        onChange={() => onBulkToggle(permIds, !allGranted)}
        title={allGranted ? t('settings.deselectAll') : t('settings.selectAll')}
      />
    </label>
  );
}

// ─── Category Section ────────────────────────────────────────────────────────

function CategorySection({
  catNode,
  hasGranular,
  mode,
  roles,
  hasRolePermission,
  onToggleRolePermission,
  rolePermissionIds,
  extraPermissionIds,
  denyPermissionIds,
  onToggleUserPermission,
  t,
}: {
  catNode: PermissionCategoryNode;
  hasGranular: boolean;
  mode: 'roles' | 'user';
  roles?: { id: number; name: string }[];
  hasRolePermission?: (roleId: number, permissionId: number) => boolean;
  onToggleRolePermission?: (roleId: number, permissionId: number) => void;
  rolePermissionIds?: Set<number>;
  extraPermissionIds?: Set<number>;
  denyPermissionIds?: Set<number>;
  onToggleUserPermission?: (permissionId: number) => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const showCatHeader = hasGranular;
  const isSectionCategory = catNode.category.id === 'section';

  return (
    <div>
      {showCatHeader && !isSectionCategory && (
        <div className="px-8 py-1.5 text-xs font-semibold text-primary-gold/80 bg-primary-gold/5 border-t border-secondary-gray/15">
          {t(catNode.category.titleKey, catNode.category.titleDefault)}
        </div>
      )}
      {catNode.permissions.map((perm) => (
        <PermissionRow
          key={perm.id}
          perm={perm}
          indent={hasGranular && !isSectionCategory}
          isSectionVisible={isSectionCategory}
          mode={mode}
          roles={roles}
          hasRolePermission={hasRolePermission}
          onToggleRolePermission={onToggleRolePermission}
          rolePermissionIds={rolePermissionIds}
          extraPermissionIds={extraPermissionIds}
          denyPermissionIds={denyPermissionIds}
          onToggleUserPermission={onToggleUserPermission}
          t={t}
        />
      ))}
    </div>
  );
}

// ─── Permission Row ──────────────────────────────────────────────────────────

function getUserPermState(
  permId: number,
  rolePerms?: Set<number>,
  extraPerms?: Set<number>,
  denyPerms?: Set<number>
): PermissionState {
  const denied = denyPerms?.has(permId) ?? false;
  if (denied) return 'denied';
  const roleGranted = rolePerms?.has(permId) ?? false;
  const extraGranted = extraPerms?.has(permId) ?? false;
  if (extraGranted) return 'extra';
  if (roleGranted) return 'granted';
  return 'none';
}

const STATE_DOTS: Record<PermissionState, string> = {
  granted: 'bg-success-green',
  extra: 'bg-blue-500',
  denied: 'bg-alert-red',
  none: 'bg-secondary-gray/30',
};

const STATE_LABELS: Record<PermissionState, string> = {
  granted: 'settings.grantedFromRole',
  extra: 'settings.extraForUser',
  denied: 'settings.deniedForUser',
  none: '',
};

function PermissionRow({
  perm,
  indent,
  isSectionVisible,
  mode,
  roles,
  hasRolePermission,
  onToggleRolePermission,
  rolePermissionIds,
  extraPermissionIds,
  denyPermissionIds,
  onToggleUserPermission,
  t,
}: {
  perm: PermissionItem;
  indent: boolean;
  isSectionVisible?: boolean;
  mode: 'roles' | 'user';
  roles?: { id: number; name: string }[];
  hasRolePermission?: (roleId: number, permissionId: number) => boolean;
  onToggleRolePermission?: (roleId: number, permissionId: number) => void;
  rolePermissionIds?: Set<number>;
  extraPermissionIds?: Set<number>;
  denyPermissionIds?: Set<number>;
  onToggleUserPermission?: (permissionId: number) => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const actionLabel = humanizePermissionAction(t, perm.action);
  const isDangerous = perm.action === 'delete' || perm.action === 'manage';

  const sectionRowClass = isSectionVisible
    ? 'bg-primary-gold/5 border-b border-primary-gold/20 py-3'
    : '';
  const sectionLabelClass = isSectionVisible
    ? 'font-semibold text-primary-gold'
    : '';

  if (mode === 'roles') {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 hover:bg-secondary-gray/5 transition-colors border-t border-secondary-gray/10 ${indent ? 'pr-12' : 'pr-8'} ${sectionRowClass}`}>
        <span className={`flex-1 text-sm text-right ${sectionLabelClass || (isDangerous ? 'text-amber-700 font-medium' : 'text-dark-charcoal')}`}>
          {isDangerous && !isSectionVisible && <AlertTriangle size={13} className="inline ml-1 text-amber-500" />}
          {isSectionVisible && <Shield size={13} className="inline ml-1 text-primary-gold" />}
          {actionLabel}
        </span>
        {roles?.map((r) => (
          <label key={r.id} className="w-16 flex items-center justify-center shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={hasRolePermission?.(r.id, perm.id) ?? false}
              onChange={() => onToggleRolePermission?.(r.id, perm.id)}
              className={`w-4 h-4 rounded border-secondary-gray focus:ring-primary-gold/40 cursor-pointer ${isSectionVisible ? 'w-5 h-5 text-primary-gold' : 'text-primary-gold'}`}
            />
          </label>
        ))}
      </div>
    );
  }

  // User mode
  const state = getUserPermState(perm.id, rolePermissionIds, extraPermissionIds, denyPermissionIds);
  const checked = state === 'granted' || state === 'extra';
  const stateLabel = STATE_LABELS[state] ? t(STATE_LABELS[state], '') : '';

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 hover:bg-secondary-gray/5 transition-colors border-t border-secondary-gray/10 ${indent ? 'pr-12' : 'pr-8'} ${sectionRowClass}`}>
      {/* State dot */}
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATE_DOTS[state]}`} />

      {/* Label */}
      <span className={`flex-1 text-sm text-right ${sectionLabelClass || (isDangerous ? 'text-amber-700 font-medium' : 'text-dark-charcoal')}`}>
        {isDangerous && !isSectionVisible && <AlertTriangle size={13} className="inline ml-1 text-amber-500" />}
        {isSectionVisible && <Shield size={13} className="inline ml-1 text-primary-gold" />}
        {actionLabel}
      </span>

      {/* State badge */}
      {stateLabel && (
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          state === 'granted' ? 'bg-success-green/10 text-success-green' :
          state === 'extra' ? 'bg-blue-50 text-blue-600' :
          state === 'denied' ? 'bg-red-50 text-alert-red' : ''
        }`}>
          {stateLabel}
        </span>
      )}

      {/* Toggle */}
      <label className="shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleUserPermission?.(perm.id)}
          className={`rounded border-secondary-gray focus:ring-primary-gold/40 cursor-pointer ${
            isSectionVisible ? 'w-5 h-5' : 'w-4 h-4'
          } ${
            state === 'denied' ? 'accent-red-500' :
            state === 'extra' ? 'accent-blue-500' :
            'text-primary-gold'
          }`}
        />
      </label>
    </div>
  );
}
