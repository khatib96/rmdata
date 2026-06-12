import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { resolveLocationCity } from '../utils/resolveLocationCity';
import { saveLastKnownLocation, getLastKnownLocation } from '../utils/lastKnownLocation';
import { resolveDeviceCoordinates } from '../utils/deviceLocation';

const HEARTBEAT_INTERVAL_MS = 45_000;
const LOCATION_INTERVAL_MS = 5 * 60_000;
const MAX_CONSECUTIVE_FAILURES = 3;

interface CachedLocation {
  gpsCoords: string;
  locationCity: string | null;
}

export function useDeviceTracker() {
  const { sessionToken, isAuthenticated, logout, markDevicePingOk } = useAuthStore();
  const heartbeatRef = useRef<number | null>(null);
  const locationRef = useRef<number | null>(null);
  const cachedLocation = useRef<CachedLocation | null>(null);
  const consecutiveFailures = useRef(0);
  const warningShown = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !sessionToken) {
      clearTimers();
      consecutiveFailures.current = 0;
      warningShown.current = false;
      return;
    }

    initCachedLocation();
    void updateLocation();
    void performHeartbeat();

    heartbeatRef.current = window.setInterval(() => void performHeartbeat(), HEARTBEAT_INTERVAL_MS);
    locationRef.current = window.setInterval(() => void updateLocation(), LOCATION_INTERVAL_MS);

    return clearTimers;

    // ── Heartbeat: fires every 45s, NEVER waits for geolocation ──────────
    async function performHeartbeat() {
      try {
        const loc = cachedLocation.current;
        const res = await window.electronAPI?.devicePing?.(
          sessionToken!,
          loc?.gpsCoords ?? null,
          loc?.locationCity ?? null,
        );
        console.log('HEARTBEAT_SENT', loc?.gpsCoords ?? 'no-location');

        if (res?.forceLogout) {
          logout();
          toast.error('تم إنهاء جلستك من قِبل مدير النظام.');
          return;
        }
        if (res?.error) {
          consecutiveFailures.current++;
          console.warn(`device:ping failed (${consecutiveFailures.current}/${MAX_CONSECUTIVE_FAILURES}):`, res.error);
          if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES && !warningShown.current) {
            warningShown.current = true;
            toast.error('فُقد الاتصال بخادم تتبع الأجهزة. تحقق من اتصالك بالشبكة أو قاعدة البيانات.', { duration: 8000 });
          }
        } else {
          markDevicePingOk();
          if (warningShown.current && consecutiveFailures.current > 0) {
            toast.success('تم استعادة الاتصال بخادم تتبع الأجهزة.', { duration: 4000 });
          }
          consecutiveFailures.current = 0;
          warningShown.current = false;
        }
      } catch (err) {
        consecutiveFailures.current++;
        console.warn(`device:ping exception (${consecutiveFailures.current}/${MAX_CONSECUTIVE_FAILURES}):`, err);
        if (consecutiveFailures.current >= MAX_CONSECUTIVE_FAILURES && !warningShown.current) {
          warningShown.current = true;
          toast.error('فُقد الاتصال بخادم تتبع الأجهزة. تحقق من اتصالك بالشبكة أو قاعدة البيانات.', { duration: 8000 });
        }
      }
    }

    // ── Location: fires every 5 min (Windows IPC or browser geolocation on macOS) ─
    async function updateLocation() {
      try {
        const coords = await resolveDeviceCoordinates();
        if (coords) {
          console.log('DEVICE_LOCATION_SUCCESS:', coords.lat, coords.lng);
          let city: string | null = null;
          try {
            city = await resolveLocationCity(coords.lat, coords.lng);
          } catch { /* ignore reverse-geocode failure */ }
          cachedLocation.current = {
            gpsCoords: `${coords.lat},${coords.lng}`,
            locationCity: city,
          };
          saveLastKnownLocation(coords.lat, coords.lng, city ?? undefined);
          return;
        }
        console.warn('DEVICE_LOCATION_FAILED: no coordinates');
      } catch (err) {
        console.warn('DEVICE_LOCATION_FAILED (exception):', err);
      }

      const lastKnown = getLastKnownLocation();
      if (lastKnown) {
        console.log('USING_LAST_KNOWN_LOCATION:', lastKnown.lat, lastKnown.lng);
        cachedLocation.current = {
          gpsCoords: `${lastKnown.lat},${lastKnown.lng}`,
          locationCity: lastKnown.city ?? null,
        };
      }
    }

    function initCachedLocation() {
      const lastKnown = getLastKnownLocation();
      if (lastKnown) {
        cachedLocation.current = {
          gpsCoords: `${lastKnown.lat},${lastKnown.lng}`,
          locationCity: lastKnown.city ?? null,
        };
      }
    }

    function clearTimers() {
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (locationRef.current) { clearInterval(locationRef.current); locationRef.current = null; }
    }
  }, [isAuthenticated, sessionToken, logout, markDevicePingOk]);
}
