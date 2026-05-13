import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser } from '../types/shared';
import { clearPermissionsCache } from '../services/permissionsService';
import { clearApiSessionToken } from '../api/apiSessionToken';

interface AuthState {
  user: AuthUser | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  /** آخر نجاح لـ device:ping على هذا الجهاز (لا يُحفظ في localStorage) */
  lastDevicePingOkAt: number | null;
  login: (user: AuthUser, sessionToken?: string) => void;
  logout: () => void;
  markDevicePingOk: () => void;
  updateLinkedEntityImagePath: (path: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      sessionToken: null,
      isAuthenticated: false,
      lastDevicePingOkAt: null,
      login: (user, sessionToken) =>
        set({ user, sessionToken: sessionToken || null, isAuthenticated: true, lastDevicePingOkAt: null }),
      logout: () => {
        const token = useAuthStore.getState().sessionToken;
        if (token) {
          window.electronAPI?.deviceLogout?.(token).catch(() => {});
        }
        clearPermissionsCache();
        clearApiSessionToken();
        set({ user: null, sessionToken: null, isAuthenticated: false, lastDevicePingOkAt: null });
      },
      markDevicePingOk: () => set({ lastDevicePingOkAt: Date.now() }),
      updateLinkedEntityImagePath: (path) =>
        set((state) =>
          state.user
            ? { user: { ...state.user, linkedEntityImagePath: path ?? undefined } }
            : {}
        ),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        sessionToken: state.sessionToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
