import { useEffect, useState } from 'react';
import { getAllSettings, SETTINGS_KEYS } from '../services/settingsService';

type ExpiryUiSettings = {
  expiryWarningDays: number;
  showGreenExpiry: boolean;
  showYellowExpiry: boolean;
  loading: boolean;
};

const DEFAULT_EXPIRY_WARNING_DAYS = 30;

export function useExpiryUiSettings(): ExpiryUiSettings {
  const [expiryWarningDays, setExpiryWarningDays] = useState<number>(DEFAULT_EXPIRY_WARNING_DAYS);
  const [showGreenExpiry, setShowGreenExpiry] = useState<boolean>(true);
  const [showYellowExpiry, setShowYellowExpiry] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  const load = async () => {
    setLoading(true);
    try {
      const s = await getAllSettings();
      const nextWarningDays = Math.max(
        1,
        parseInt(s[SETTINGS_KEYS.EXPIRY_WARNING_DAYS] ?? '30', 10) || DEFAULT_EXPIRY_WARNING_DAYS
      );
      const nextShowGreen = (s[SETTINGS_KEYS.SHOW_GREEN_EXPIRY] ?? '1') === '1';
      const nextShowYellow = (s[SETTINGS_KEYS.SHOW_YELLOW_EXPIRY] ?? '1') === '1';

      setExpiryWarningDays(nextWarningDays);
      setShowGreenExpiry(nextShowGreen);
      setShowYellowExpiry(nextShowYellow);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handler = () => {
      load();
    };
    window.addEventListener('expiry-ui-settings-changed', handler);
    return () => window.removeEventListener('expiry-ui-settings-changed', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { expiryWarningDays, showGreenExpiry, showYellowExpiry, loading };
}

