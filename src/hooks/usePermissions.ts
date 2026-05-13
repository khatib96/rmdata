import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  loadPermissions,
  clearPermissionsCache,
  has as hasPermission,
  canSection as checkSection,
  canField as checkField,
  canTab as checkTab,
  canView as checkView,
  permsToArray,
} from '../services/permissionsService';

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load permissions on mount / user change
  useEffect(() => {
    if (!user?.id) {
      setPerms(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const opts = {
      remoteUserId: user.remoteUserId,
      username: user.username,
      isDevAccount: user.isDevAccount,
    };

    loadPermissions(user.id, user.roleId ?? 1, opts).then((result) => {
      if (!cancelled) {
        console.log(`[usePermissions] Loaded perms for ${user.username}: ${result.size} keys, roleId=${user.roleId}`);
        setPerms(result);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id, user?.roleId, user?.username, user?.isDevAccount]);

  // Refresh on settings save
  useEffect(() => {
    if (!user?.id) return;

    const opts = {
      remoteUserId: user.remoteUserId,
      username: user.username,
      isDevAccount: user.isDevAccount,
    };

    const handler = () => {
      clearPermissionsCache();
      setLoading(true);
      loadPermissions(user.id, user.roleId ?? 1, opts)
        .then((result) => setPerms(result))
        .finally(() => setLoading(false));
    };

    window.addEventListener('permissions-changed', handler);
    return () => window.removeEventListener('permissions-changed', handler);
  }, [user?.id, user?.roleId, user?.username]);

  // ─── Permission check functions ─────────────────────────────
  const has = useCallback(
    (module: string, action: string) => hasPermission(perms, module, action),
    [perms]
  );

  const section = useCallback(
    (module: string) => checkSection(perms, module),
    [perms]
  );

  const tab = useCallback(
    (module: string, tabId: string) => checkTab(perms, module, tabId),
    [perms]
  );

  const field = useCallback(
    (module: string, fieldId: string) => checkField(perms, module, fieldId),
    [perms]
  );

  const view = useCallback(
    (module: string) => checkView(perms, module),
    [perms]
  );

  // ─── Backward compatibility ─────────────────────────────────
  // Old components use can(module, action) and canSection(module)
  const canOld = useCallback(
    (module: string, action: string) => hasPermission(perms, module, action),
    [perms]
  );

  const canSectionOld = useCallback(
    (module: string) => checkSection(perms, module),
    [perms]
  );

  // Old components use permissions as PermissionEntry[]
  const permissionsArray = useMemo(() => permsToArray(perms), [perms]);

  // Admin: roleId=1 → bypass all field-level checks (Number() for type safety)
  const isAdmin = Number(user?.roleId) === 1;
  const granularFieldBypass = isAdmin || Boolean(user?.isDevAccount);

  return {
    // New API
    has,
    section,
    tab,
    field,
    view,
    perms,

    // Old API (backward compat)
    can: canOld,
    canSection: canSectionOld,
    loading,
    permissions: permissionsArray,
    granularFieldBypass,
    isAdmin,
  };
}
