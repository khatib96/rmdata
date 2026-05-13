import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types/shared';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

function mapRoleNameToUserRole(roleName: string): UserRole {
  if (roleName === 'Admin') return UserRole.SUPER_ADMIN;
  if (roleName === 'Manager') return UserRole.MANAGER;
  return UserRole.EMPLOYEE;
}

export default function Login() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMustChangeModal, setShowMustChangeModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const { login, user } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const api = window.electronAPI;
      if (!api?.authLogin) {
        toast.error(t('auth.loginNotAvailable'));
        setLoading(false);
        return;
      }
      const result = await api.authLogin(username.trim(), password);
      if (result.success && result.user) {
        const u = result.user;
        const authUser = {
          id: u.id,
          remoteUserId: u.remoteUserId ?? u.id,
          username: u.username,
          email: u.email,
          fullName: u.fullName,
          role: mapRoleNameToUserRole(u.roleName),
          roleId: u.roleId,
          userType: u.userType ?? 'free',
          linkedEntityType: u.linkedEntityType,
          linkedEntityId: u.linkedEntityId,
          linkedEntityName: u.linkedEntityName,
          linkedEntityImagePath: u.linkedEntityImagePath,
          linkedBranchName: u.linkedBranchName,
          linkedProfession: u.linkedProfession,
          mustChangePassword: u.mustChangePassword ?? false,
          isDevAccount: u.isDevAccount ?? false,
        };
        login(authUser, result.sessionToken);
        if (authUser.mustChangePassword) {
          setCurrentPassword(password);
          setShowMustChangeModal(true);
        } else {
          toast.success(t('auth.loginSuccess'));
          navigate('/dashboard');
        }
      } else {
        if (result.error === 'ACCOUNT_DISABLED') {
          toast.error(t('auth.accountDisabled'));
        } else if (result.error === 'REMOTE_NOT_CONFIGURED') {
          toast.error(t('auth.remoteNotConfigured'));
        } else if (result.error === 'REMOTE_LOGIN_UNAVAILABLE') {
          toast.error(t('auth.remoteLoginUnavailable'));
        } else if (result.error === 'TOO_MANY_ATTEMPTS' && result.remainingSec != null) {
          toast.error(t('auth.tooManyAttempts', { sec: result.remainingSec }));
        } else {
          toast.error(t('auth.invalidCredentials'));
        }
      }
    } catch {
      toast.error(t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || newPassword.length < 8) {
      toast.error(t('settings.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    setChangePasswordLoading(true);
    try {
      const res = await window.electronAPI?.authChangeOwnPassword?.(user.id, currentPassword, newPassword);
      if (res?.success) {
        login({ ...user, mustChangePassword: false });
        toast.success(t('auth.passwordChanged'));
        setShowMustChangeModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        navigate('/dashboard');
      } else {
        if (res?.error === 'INVALID_CURRENT_PASSWORD') toast.error(t('auth.invalidCurrentPassword'));
        else toast.error(t('auth.changePasswordFailed'));
      }
    } finally {
      setChangePasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-background">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-gold mb-2">
            {t('app.title')}
          </h1>
          <p className="text-secondary-gray">{t('auth.login')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-dark-charcoal mb-2"
            >
              {t('auth.username')}
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-secondary-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-gold"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-dark-charcoal mb-2"
            >
              {t('auth.password')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 pr-11 border border-secondary-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-gold"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-secondary-gray hover:text-dark-charcoal transition-colors"
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-gold text-white py-2 px-4 rounded-lg hover:bg-accent-sand transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </form>
      </div>

      {showMustChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-dark-charcoal mb-2">{t('auth.mustChangePasswordTitle')}</h3>
            <p className="text-sm text-secondary-gray mb-4">{t('auth.mustChangePasswordDesc')}</p>
            <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('auth.currentPassword')}</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-secondary-gray rounded-lg"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-3 text-secondary-gray hover:text-dark-charcoal transition-colors"
                    aria-label={showCurrentPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    title={showCurrentPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('auth.newPasswordLabel')}</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-secondary-gray rounded-lg"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-3 text-secondary-gray hover:text-dark-charcoal transition-colors"
                    aria-label={showNewPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    title={showNewPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('settings.confirmPassword')}</label>
                <div className="relative">
                  <input
                    type={showConfirmNewPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-secondary-gray rounded-lg"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-3 text-secondary-gray hover:text-dark-charcoal transition-colors"
                    aria-label={showConfirmNewPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    title={showConfirmNewPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={changePasswordLoading} className="px-4 py-2 rounded-lg bg-primary-gold text-white disabled:opacity-50">
                  {changePasswordLoading ? t('settings.saving') : t('auth.changePassword')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
