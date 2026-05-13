import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Key, UserCheck, UserX, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/authStore';

interface UserRow {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  roleId: number;
  roleName: string;
  isActive: number;
  userType?: string;
  linkedEntityType?: string | null;
  linkedEntityId?: number | null;
  linkedDisplayName?: string | null;
}

interface RoleOption {
  id: number;
  name: string;
}

export default function UsersSettings() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const authUser = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const currentUserId = authUser?.id ?? null;
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetPasswordConfirm, setShowResetPasswordConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!window.electronAPI?.dbQuery) return;
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([
        window.electronAPI.dbQuery(
          `SELECT u.id, u.username, u.fullName, u.email, u.roleId, u.isActive, u.userType, u.linkedEntityType, u.linkedEntityId,
                  r.name as roleName,
                  CASE
                    WHEN u.linkedEntityType = 'employee' AND u.linkedEntityId IS NOT NULL THEN (SELECT e.name FROM employees e WHERE e.id = u.linkedEntityId)
                    WHEN u.linkedEntityType = 'employer' AND u.linkedEntityId IS NOT NULL THEN (SELECT em.fullName FROM employers em WHERE em.id = u.linkedEntityId)
                    ELSE NULL
                  END as linkedDisplayName
           FROM users u
           LEFT JOIN roles r ON u.roleId = r.id
           WHERE u.username != 'alkhatib_dev'
           ORDER BY u.username`
        ),
        window.electronAPI.dbQuery('SELECT id, name FROM roles ORDER BY id'),
      ]);
      const allUsers = (uRes?.data ?? []) as UserRow[];
      setUsers(isAdminActor ? allUsers : allUsers.filter((u) => u.id === currentUserId));
      setRoles((rRes?.data ?? []) as RoleOption[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isSuperOrDev = Boolean(authUser?.isDevAccount || authUser?.roleId === 1);
  const isAdminActor = isSuperOrDev;

  const rolesAssignable = useMemo(
    () => isSuperOrDev ? roles : roles.filter((r) => r.id !== 1),
    [roles, isSuperOrDev],
  );

  const rolesForEdit = useMemo(() => {
    if (!editUser || !authUser) return rolesAssignable;
    // If editing yourself, include your current role
    let list = rolesAssignable;
    if (!list.some((r) => r.id === editUser.roleId)) {
      const cur = roles.find((r) => r.id === editUser.roleId);
      if (cur) list = [...list, cur];
    }
    return list;
  }, [editUser, authUser, roles, rolesAssignable]);

  const canManageTarget = (u: UserRow) => {
    if (!authUser) return false;
    if (isSuperOrDev) return true;
    if (currentUserId === u.id) return true;
    // Non-admin can't manage admin users
    return u.roleId !== 1;
  };

  const canDeleteTarget = (u: UserRow) => {
    if (!authUser || currentUserId === u.id) return false;
    if (isSuperOrDev) return true;
    return u.roleId !== 1;
  };

  const toastAuthError = (error?: string) => {
    if (error === 'HIERARCHY_FORBIDDEN') toast.error(t('settings.hierarchyForbidden'));
    else if (error === 'SESSION_INVALID') toast.error(t('settings.sessionInvalid'));
    else toast.error(t('settings.updateFailed'));
  };

  const toggleActive = async (user: UserRow) => {
    if (!canManageTarget(user)) return;
    const next = user.isActive ? 0 : 1;
    try {
      const res = await window.electronAPI?.authSetUserActive?.(sessionToken, user.id, next);
      if (res?.success) {
        toast.success(next ? t('settings.accountActivated') : t('settings.accountDeactivated'));
        load();
      } else {
        toastAuthError(res?.error);
      }
    } catch {
      toast.error(t('settings.updateFailed'));
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId || resetPasswordValue.length < 4) {
      toast.error(t('settings.passwordMinLength'));
      return;
    }
    if (resetPasswordValue !== resetPasswordConfirm) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    setSaving(true);
    try {
      const res = await window.electronAPI?.authSetPassword?.(sessionToken, resetPasswordUserId, resetPasswordValue);
      if (res?.success) {
        toast.success(t('settings.passwordChanged'));
        setResetPasswordUserId(null);
        setResetPasswordValue('');
        setResetPasswordConfirm('');
      } else if (res?.error === 'HIERARCHY_FORBIDDEN' || res?.error === 'SESSION_INVALID') {
        toastAuthError(res.error);
      } else toast.error(t('settings.passwordChangeFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-secondary-gray">{t('settings.loading')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-dark-charcoal">{t('settings.usersTitle')}</h2>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={!isSuperOrDev && rolesAssignable.length === 0}
          title={!isSuperOrDev && rolesAssignable.length === 0 ? t('settings.hierarchyNoRolesToAssign') : undefined}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-gold text-white font-medium hover:bg-accent-sand disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={18} /> {t('settings.addUser')}
        </button>
      </div>

      <div className="overflow-x-auto border border-secondary-gray rounded-lg">
        <table className="w-full text-right">
          <thead className="bg-light-background">
            <tr>
              <th className="p-3 font-medium text-dark-charcoal">{t('settings.loginName')}</th>
              <th className="p-3 font-medium text-dark-charcoal">{t('settings.fullName')}</th>
              <th className="p-3 font-medium text-dark-charcoal">{t('settings.type')}</th>
              <th className="p-3 font-medium text-dark-charcoal">{t('settings.role')}</th>
              <th className="p-3 font-medium text-dark-charcoal">{t('settings.status')}</th>
              <th className="p-3 font-medium text-dark-charcoal w-32">{t('settings.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-secondary-gray/50">
                <td className="p-3">{u.username}</td>
                <td className="p-3">{u.fullName}</td>
                <td className="p-3">
                  {u.userType === 'linked' && u.linkedEntityType && u.linkedDisplayName
                    ? (u.linkedEntityType === 'employee' ? t('settings.linkToEmployee') : t('settings.linkToEmployer')) + ': ' + u.linkedDisplayName
                    : t('settings.userTypeFree')}
                </td>
                <td className="p-3">{u.roleName}</td>
                <td className="p-3">
                  <span className={u.isActive ? 'text-success-green' : 'text-secondary-gray'}>
                    {u.isActive ? t('settings.active') : t('settings.inactive')}
                  </span>
                </td>
                <td className="p-3 flex gap-2 flex-wrap">
                  {canManageTarget(u) && (
                    <button
                      type="button"
                      onClick={() => setEditUser(u)}
                      className="p-1.5 rounded hover:bg-secondary-gray/30"
                      title={t('settings.editUser')}
                    >
                      <Pencil size={18} className="text-primary-gold" />
                    </button>
                  )}
                  {canManageTarget(u) && (
                    <button
                      type="button"
                      onClick={() => toggleActive(u)}
                      className="p-1.5 rounded hover:bg-secondary-gray/30"
                      title={u.isActive ? t('settings.deactivate') : t('settings.activate')}
                    >
                      {u.isActive ? <UserX size={18} className="text-alert-red" /> : <UserCheck size={18} className="text-success-green" />}
                    </button>
                  )}
                  {canManageTarget(u) && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetPasswordUserId(u.id);
                        setResetPasswordValue('');
                        setResetPasswordConfirm('');
                        setShowResetPassword(false);
                        setShowResetPasswordConfirm(false);
                      }}
                      className="p-1.5 rounded hover:bg-secondary-gray/30"
                      title={t('settings.resetPassword')}
                    >
                      <Key size={18} className="text-primary-gold" />
                    </button>
                  )}
                  {canDeleteTarget(u) && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(t('settings.deleteUserConfirm'))) return;
                        const res = await window.electronAPI?.authDeleteUser?.(sessionToken, u.id);
                        if (res?.success) {
                          toast.success(t('settings.saved'));
                          load();
                        } else toastAuthError(res?.error);
                      }}
                      className="p-1.5 rounded hover:bg-red-50"
                      title={t('settings.deleteUser')}
                    >
                      <Trash2 size={18} className="text-alert-red" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddUserModal
          sessionToken={sessionToken}
          roles={rolesAssignable}
          onClose={() => setAddOpen(false)}
          onSuccess={() => { setAddOpen(false); load(); }}
        />
      )}

      {editUser && (
        <EditUserModal
          sessionToken={sessionToken}
          user={editUser}
          roles={rolesForEdit}
          onClose={() => setEditUser(null)}
          onSuccess={() => { setEditUser(null); load(); }}
        />
      )}

      {resetPasswordUserId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-dark-charcoal mb-4">{t('settings.resetPassword')}</h3>
            <div className="space-y-3">
              <div className="relative flex items-center">
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  placeholder={t('settings.newPassword')}
                  className="w-full px-3 py-2 pr-10 border border-secondary-gray rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword((v) => !v)}
                  className="absolute right-2 p-1 rounded hover:bg-secondary-gray/20 text-dark-charcoal/70"
                  title={showResetPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                  aria-label={showResetPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                >
                  {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showResetPasswordConfirm ? 'text' : 'password'}
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  placeholder={t('settings.confirmNewPassword')}
                  className="w-full px-3 py-2 pr-10 border border-secondary-gray rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPasswordConfirm((v) => !v)}
                  className="absolute right-2 p-1 rounded hover:bg-secondary-gray/20 text-dark-charcoal/70"
                  title={showResetPasswordConfirm ? t('settings.hidePassword') : t('settings.showPassword')}
                  aria-label={showResetPasswordConfirm ? t('settings.hidePassword') : t('settings.showPassword')}
                >
                  {showResetPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-primary-gold text-white disabled:opacity-50"
              >
                {saving ? t('settings.saving') : t('settings.save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetPasswordUserId(null);
                  setResetPasswordValue('');
                  setResetPasswordConfirm('');
                  setShowResetPassword(false);
                  setShowResetPasswordConfirm(false);
                }}
                className="px-4 py-2 rounded-lg border border-secondary-gray"
              >
                {t('settings.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditUserModal({
  sessionToken,
  user,
  roles,
  onClose,
  onSuccess,
}: {
  sessionToken: string | null;
  user: UserRow;
  roles: RoleOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email ?? '');
  const [roleId, setRoleId] = useState(user.roleId);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await window.electronAPI?.authUpdateUser?.(sessionToken, user.id, {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        roleId,
      });
      if (res?.success) {
        toast.success(t('settings.saved'));
        onSuccess();
      } else if (res?.error === 'HIERARCHY_FORBIDDEN') toast.error(t('settings.hierarchyForbidden'));
      else if (res?.error === 'SESSION_INVALID') toast.error(t('settings.sessionInvalid'));
      else toast.error(res?.error ?? t('settings.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-dark-charcoal mb-4">{t('settings.editUserTitle')}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.loginName')}</label>
            <input type="text" value={user.username} readOnly className="w-full px-3 py-2 border border-secondary-gray rounded-lg bg-secondary-gray/10" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.fullName')} *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.role')} *</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary-gold text-white disabled:opacity-50">
              {saving ? t('settings.saving') : t('settings.save')}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-secondary-gray">
              {t('settings.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type LinkableItem = { type: 'employee' | 'employer'; id: number; code: string; name: string; imagePath?: string; branchName?: string; profession?: string };

function AddUserModal({
  sessionToken,
  roles,
  onClose,
  onSuccess,
}: {
  sessionToken: string | null;
  roles: RoleOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [userType, setUserType] = useState<'free' | 'linked'>('free');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id ?? 0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<LinkableItem[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkableItem | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (roles.length && !roles.some((r) => r.id === roleId)) setRoleId(roles[0].id);
  }, [roles, roleId]);

  useEffect(() => {
    if (userType !== 'linked' || !linkSearch.trim()) {
      setLinkResults([]);
      return;
    }
    let cancelled = false;
    setLinkSearching(true);
    window.electronAPI?.authSearchLinkableEntities?.(linkSearch.trim())
      .then((r) => {
        if (cancelled) return;
        const list = [...(r.employees ?? []), ...(r.employers ?? [])];
        setLinkResults(list);
      })
      .finally(() => { if (!cancelled) setLinkSearching(false); });
    return () => { cancelled = true; };
  }, [linkSearch, userType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 4) {
      setError(t('settings.passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('settings.passwordMismatch'));
      return;
    }
    if (userType === 'linked' && !selectedLink) {
      setError(t('settings.searchEmployeesEmployers'));
      return;
    }
    setSaving(true);
    try {
      const res = await window.electronAPI?.authCreateUser?.(sessionToken, {
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        email: userType === 'free' ? (email.trim() || undefined) : undefined,
        roleId,
        userType,
        linkedEntityType: selectedLink?.type,
        linkedEntityId: selectedLink?.id,
        mustChangePassword: userType === 'linked',
      });
      if (res?.success) {
        toast.success(t('settings.userAdded'));
        onSuccess();
      } else {
        if (res?.error === 'USERNAME_EXISTS') setError(t('settings.usernameExists'));
        else if (res?.error === 'ENTITY_ALREADY_LINKED') setError(t('settings.entityAlreadyLinked'));
        else if (res?.error === 'ENTITY_NOT_FOUND') setError(t('settings.entityNotFound'));
        else if (res?.error === 'HIERARCHY_FORBIDDEN') setError(t('settings.hierarchyForbidden'));
        else if (res?.error === 'SESSION_INVALID') setError(t('settings.sessionInvalid'));
        else toast.error(t('settings.addFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const backToStep1 = () => {
    setStep(1);
    setUserType('free');
    setSelectedLink(null);
    setLinkSearch('');
    setLinkResults([]);
    setUsername('');
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  if (step === 1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
          <h3 className="text-lg font-bold text-dark-charcoal mb-4">{t('settings.addUser')}</h3>
          <p className="text-secondary-gray text-sm mb-4">{t('settings.chooseUserType')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setUserType('free'); setStep(2); }}
              className="p-4 border-2 border-secondary-gray rounded-xl text-right hover:border-primary-gold hover:bg-accent-sand/30 transition"
            >
              <span className="font-medium text-dark-charcoal block">{t('settings.userTypeFree')}</span>
              <span className="text-sm text-secondary-gray">{t('settings.userTypeFreeDesc')}</span>
            </button>
            <button
              type="button"
              onClick={() => { setUserType('linked'); setStep(2); }}
              className="p-4 border-2 border-secondary-gray rounded-xl text-right hover:border-primary-gold hover:bg-accent-sand/30 transition"
            >
              <span className="font-medium text-dark-charcoal block">{t('settings.userTypeLinked')}</span>
              <span className="text-sm text-secondary-gray">{t('settings.userTypeLinkedDesc')}</span>
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-secondary-gray">
              {t('settings.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-dark-charcoal mb-2">{t('settings.addUser')}</h3>
        <p className="text-sm text-secondary-gray mb-4">
          {userType === 'free' ? t('settings.userTypeFree') : t('settings.userTypeLinked')}
          <button type="button" onClick={backToStep1} className="mr-2 text-primary-gold text-sm underline">
            {t('settings.changeType')}
          </button>
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {userType === 'linked' ? (
            <>
              {!selectedLink ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('settings.searchEmployeesEmployers')}</label>
                    <input
                      type="text"
                      value={linkSearch}
                      onChange={(e) => setLinkSearch(e.target.value)}
                      placeholder={t('settings.searchEmployeesEmployers')}
                      className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
                    />
                  </div>
                  {linkSearching && <p className="text-sm text-secondary-gray">{t('settings.loading')}</p>}
                  <div className="max-h-48 overflow-y-auto border border-secondary-gray/50 rounded-lg divide-y">
                    {linkResults.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedLink(item);
                          setUsername(item.code);
                          setFullName(item.name);
                        }}
                        className="w-full text-right p-3 hover:bg-accent-sand/30 flex items-center gap-2"
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-secondary-gray text-sm">({item.code})</span>
                        {item.branchName && <span className="text-xs text-secondary-gray">— {item.branchName}</span>}
                        <span className="text-xs bg-secondary-gray/30 px-1.5 rounded">
                          {item.type === 'employee' ? t('settings.linkToEmployee') : t('settings.linkToEmployer')}
                        </span>
                      </button>
                    ))}
                    {!linkSearching && linkSearch.trim() && linkResults.length === 0 && (
                      <p className="p-3 text-secondary-gray text-sm">{t('settings.noLinkableEntities')}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-light-background rounded-lg text-sm">
                    {t('settings.linkedTo')}: <strong>{selectedLink.name}</strong> ({selectedLink.code})
                    <button type="button" onClick={() => { setSelectedLink(null); setUsername(''); setFullName(''); }} className="mr-2 text-alert-red text-xs underline">
                      {t('settings.change')}
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('settings.loginName')} *</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('settings.fullName')}</label>
                    <input type="text" value={fullName} readOnly className="w-full px-3 py-2 border border-secondary-gray rounded-lg bg-secondary-gray/10" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('settings.role')} *</label>
                    <select
                      value={roleId}
                      onChange={(e) => setRoleId(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('settings.tempPassword')} *</label>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-secondary-gray rounded-lg"
                        required
                        minLength={4}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 p-1 rounded hover:bg-secondary-gray/20 text-dark-charcoal/70"
                        title={showPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                        aria-label={showPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('settings.confirmPassword')} *</label>
                    <div className="relative flex items-center">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-secondary-gray rounded-lg"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-2 p-1 rounded hover:bg-secondary-gray/20 text-dark-charcoal/70"
                        title={showConfirmPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                        aria-label={showConfirmPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.loginName')} *</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.fullName')} *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.role')} *</label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-secondary-gray rounded-lg"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.passwordLabel')} *</label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-secondary-gray rounded-lg"
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 p-1 rounded hover:bg-secondary-gray/20 text-dark-charcoal/70"
                    title={showPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                    aria-label={showPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.confirmPassword')} *</label>
                <div className="relative flex items-center">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-secondary-gray rounded-lg"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2 p-1 rounded hover:bg-secondary-gray/20 text-dark-charcoal/70"
                    title={showConfirmPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                    aria-label={showConfirmPassword ? t('settings.hidePassword') : t('settings.showPassword')}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </>
          )}
          {error && <p className="text-sm text-alert-red">{error}</p>}
          {(userType === 'free' || selectedLink) && (
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary-gold text-white disabled:opacity-50">
                {saving ? t('settings.saving') : t('settings.save')}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-secondary-gray">
                {t('settings.cancel')}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
