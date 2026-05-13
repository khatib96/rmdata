import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { FormModal } from '../shared/FormModal';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/shared';

interface UserProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ open, onClose }: UserProfileModalProps) {
  const { t } = useTranslation();
  const { user, login, sessionToken } = useAuthStore();

  const [activeTab, setActiveTab] = useState<1 | 2>(1);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      setFullName(user.fullName ?? '');
      setEmail(user.email ?? '');
      setActiveTab(1);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
    }
  }, [open, user]);

  const resolveAvatarPath = useCallback(() => {
    if (!user) return undefined;
    return user.userType === 'free' ? user.avatarPath : user.linkedEntityImagePath;
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const imagePath = resolveAvatarPath();
    if (!imagePath || !window.electronAPI?.fileGetImageUrl) {
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    window.electronAPI.fileGetImageUrl(imagePath).then((r) => {
      if (!cancelled) setAvatarUrl(r?.success && r.url ? r.url : null);
    }).catch(() => { if (!cancelled) setAvatarUrl(null); });
    return () => { cancelled = true; };
  }, [open, resolveAvatarPath]);

  const handleChangeAvatar = async () => {
    if (!user || !window.electronAPI?.fileSelectImage) return;
    setSavingAvatar(true);
    try {
      const picked = await window.electronAPI.fileSelectImage();
      if (picked.canceled || !picked.success || !picked.base64Data || !picked.filename) return;

      const ext = picked.filename.split('.').pop() ?? 'jpg';
      const saved = await window.electronAPI.fileSaveImage?.(
        picked.base64Data,
        `user_${user.id}_${Date.now()}.${ext}`,
      );
      if (!saved?.success || !saved.relativePath) {
        toast.error(saved?.error ?? t('common.error', 'Error'));
        return;
      }

      const updated = await window.electronAPI.authUpdateUser?.(sessionToken, user.id, {
        avatarPath: saved.relativePath,
      });
      if (!updated?.success) {
        toast.error(updated?.error ?? t('common.error', 'Error'));
        return;
      }

      const urlRes = await window.electronAPI.fileGetImageUrl(saved.relativePath);
      if (urlRes?.success && urlRes.url) setAvatarUrl(urlRes.url);

      login({ ...user, avatarPath: saved.relativePath });
      toast.success(t('profile.savedSuccess'));
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!user) return;
    setSavingInfo(true);
    try {
      const result = await window.electronAPI?.authUpdateUser?.(sessionToken, user.id, {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
      });
      if (!result?.success) {
        toast.error(result?.error ?? t('common.error', 'Error'));
        return;
      }
      login({ ...user, fullName: fullName.trim(), email: email.trim() });
      toast.success(t('profile.savedSuccess'));
    } finally {
      setSavingInfo(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 4) {
      setPasswordError(t('profile.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'));
      return;
    }
    if (!user) return;
    setSavingPassword(true);
    try {
      const result = await window.electronAPI?.authChangeOwnPassword?.(
        user.id,
        currentPassword,
        newPassword,
      );
      if (!result?.success) {
        setPasswordError(
          result?.error === 'INVALID_CURRENT_PASSWORD'
            ? t('auth.invalidCurrentPassword')
            : (result?.error ?? t('common.error', 'Error')),
        );
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('profile.savedSuccess'));
    } finally {
      setSavingPassword(false);
    }
  };

  const roleBadgeClass = (role?: string) => {
    if (role === UserRole.SUPER_ADMIN)
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    if (role === UserRole.MANAGER)
      return 'bg-blue-100 text-blue-800 border border-blue-300';
    return 'bg-gray-100 text-gray-600 border border-gray-300';
  };

  if (!user) return null;

  const steps = [
    { step: 1, label: t('profile.tabInfo') },
    { step: 2, label: t('profile.tabPassword') },
  ];

  const inputCls =
    'w-full border border-secondary-gray rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-gold transition-colors';
  const disabledInputCls =
    'w-full border border-secondary-gray rounded-lg px-3 py-2 text-sm bg-gray-50 text-dark-charcoal/50 cursor-not-allowed';
  const labelCls = 'block text-sm font-medium text-dark-charcoal mb-1';
  const submitBtnCls =
    'w-full bg-primary-gold text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-gold/90 disabled:opacity-60 transition-colors';

  return (
    <FormModal
      isOpen={open}
      onClose={onClose}
      title={t('profile.title')}
      steps={steps}
      currentStep={activeTab}
      onStepClick={(s) => setActiveTab(s as 1 | 2)}
    >
      <div className="p-6 space-y-6">
        {/* Profile header */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-20 h-20">
            <div className="w-20 h-20 rounded-full bg-primary-gold flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                user.fullName?.charAt(0) ?? ''
              )}
            </div>
            {user.userType === 'free' && (
              <button
                type="button"
                onClick={handleChangeAvatar}
                disabled={savingAvatar}
                className="absolute bottom-0 right-0 w-7 h-7 bg-primary-gold rounded-full flex items-center justify-center text-white shadow-md hover:bg-primary-gold/80 disabled:opacity-60 transition-colors"
                aria-label={t('profile.changeAvatar')}
              >
                <Camera size={13} aria-hidden />
              </button>
            )}
          </div>

          {user.userType === 'linked' && (
            <p className="text-xs text-dark-charcoal/50 text-center">
              {t('profile.linkedAvatarNote')}
            </p>
          )}

          <div className="text-center">
            <p className="text-lg font-bold text-dark-charcoal">{user.fullName}</p>
            <p className="text-sm text-dark-charcoal/60 mb-1">@{user.username}</p>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(user.role)}`}
            >
              {user.role}
            </span>
          </div>

          {user.userType === 'linked' && user.linkedEntityName && (
            <p className="text-sm text-dark-charcoal/60 text-center">
              {[user.linkedProfession, user.linkedEntityName, user.linkedBranchName]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        {/* Tab content */}
        {activeTab === 1 ? (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{t('profile.fullName')}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t('profile.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                dir="ltr"
              />
            </div>
            <div>
              <label className={labelCls}>{t('profile.username')}</label>
              <input
                type="text"
                value={user.username}
                disabled
                className={disabledInputCls}
                dir="ltr"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveInfo}
              disabled={savingInfo || !fullName.trim()}
              className={submitBtnCls}
            >
              {savingInfo ? t('profile.saving') : t('profile.saveInfo')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{t('profile.currentPassword')}</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordError(null);
                }}
                className={inputCls}
                dir="ltr"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className={labelCls}>{t('profile.newPassword')}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError(null);
                }}
                className={inputCls}
                dir="ltr"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={labelCls}>{t('profile.confirmPassword')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError(null);
                }}
                className={inputCls}
                dir="ltr"
                autoComplete="new-password"
              />
            </div>
            {passwordError && (
              <p className="text-alert-red text-sm" role="alert">
                {passwordError}
              </p>
            )}
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              className={submitBtnCls}
            >
              {savingPassword ? t('profile.saving') : t('profile.changePassword')}
            </button>
          </div>
        )}
      </div>
    </FormModal>
  );
}
