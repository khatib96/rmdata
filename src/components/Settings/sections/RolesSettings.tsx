import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { clearPermissionsCache } from '../../../services/permissionsService';
import PermissionTree from '../shared/PermissionTree';

interface RoleRow {
  id: number;
  name: string;
  description: string | null;
}

interface PermissionRow {
  id: number;
  module: string;
  action: string;
}

function key(rId: number, pId: number) {
  return `${rId}-${pId}`;
}

const PERM_CATALOG_SYNC_KEY = 'rmdata_perm_catalog_synced_v1';

export default function RolesSettings() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const initialSelected = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.dbQuery) return;
    (async () => {
      setLoading(true);
      try {
        if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(PERM_CATALOG_SYNC_KEY)) {
          void api.syncPermissionCatalog?.().then((res) => {
            if (res?.success) sessionStorage.setItem(PERM_CATALOG_SYNC_KEY, '1');
          });
        }
        const [rRes, pRes, rpRes] = await Promise.all([
          api.dbQuery('SELECT id, name, description FROM roles ORDER BY id'),
          api.dbQuery('SELECT id, module, action FROM permissions ORDER BY module, action'),
          api.dbQuery('SELECT roleId, permissionId FROM role_permissions'),
        ]);
        const allRoles = (rRes?.data ?? []) as RoleRow[];
        // Admin keeps full access and is not editable here.
        const editableRoles = allRoles.filter((r) => String(r.name).toLowerCase() !== 'admin');
        setRoles(editableRoles);
        setPermissions((pRes?.data ?? []) as PermissionRow[]);
        const rp = (rpRes?.data ?? []) as { roleId: number; permissionId: number }[];
        const set = new Set(rp.map((x) => key(x.roleId, x.permissionId)));
        initialSelected.current = new Set(set);
        setSelected(set);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasPermission = (roleId: number, permissionId: number) =>
    selected.has(key(roleId, permissionId));

  const togglePermission = (roleId: number, permissionId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = key(roleId, permissionId);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const bulkSetRolePermissions = (roleId: number, permissionIds: number[], grant: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const pid of permissionIds) {
        const k = key(roleId, pid);
        if (grant) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!window.electronAPI?.dbQuery) return;
    setSaving(true);
    try {
      for (const r of roles) {
        await window.electronAPI.dbQuery('DELETE FROM role_permissions WHERE roleId = ?', [r.id]);
        for (const p of permissions) {
          if (selected.has(key(r.id, p.id))) {
            await window.electronAPI.dbQuery(
              'INSERT INTO role_permissions (roleId, permissionId) VALUES (?, ?)',
              [r.id, p.id]
            );
          }
        }
      }
      initialSelected.current = new Set(selected);
      toast.success(t('settings.saved'));
      clearPermissionsCache();
      window.dispatchEvent(new CustomEvent('permissions-changed', {}));
    } catch {
      toast.error(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    selected.size !== initialSelected.current.size ||
    [...selected].some((k) => !initialSelected.current.has(k)) ||
    [...initialSelected.current].some((k) => !selected.has(k));

  if (loading) return <p className="text-secondary-gray">{t('settings.loading')}</p>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-dark-charcoal">{t('settings.rolesTitle')}</h2>
          <p className="text-secondary-gray text-sm mt-1">{t('settings.rolesDescription')}</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-5 py-2.5 rounded-lg bg-primary-gold text-white font-medium hover:bg-accent-sand disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {saving ? t('settings.saving') : t('settings.save')}
        </button>
      </div>

      {/* Permission Tree */}
      <PermissionTree
        permissions={permissions}
        mode="roles"
        roles={roles}
        hasRolePermission={hasPermission}
        onToggleRolePermission={togglePermission}
        onBulkSetRolePermissions={bulkSetRolePermissions}
      />
    </div>
  );
}
