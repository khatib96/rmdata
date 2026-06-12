/** Resolve device coordinates: Windows native IPC first, then browser geolocation (macOS/Electron). */
export async function resolveDeviceCoordinates(): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await window.electronAPI?.getWindowsLocation?.();
    if (res?.success && res.lat != null && res.lng != null) {
      return { lat: res.lat, lng: res.lng };
    }
  } catch {
    /* Windows IPC unavailable or failed */
  }

  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
      );
    });
  }

  return null;
}
