/** Any SQL touching `connected_devices` must not fall back to local SQLite when remote mode is on. */
export function isConnectedDevicesQuery(query: string): boolean {
  return /\bconnected_devices\b/i.test(String(query ?? '').trim());
}
