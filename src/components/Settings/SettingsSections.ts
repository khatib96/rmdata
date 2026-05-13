/**
 * Settings sections — roles removed, permissions is the single authority
 */
import { Building2, Globe, Users, Bell, Database, HardDriveDownload, Info, Key, Monitor } from 'lucide-react';

export const SETTINGS_SECTIONS = [
  { id: 'general', path: 'general', labelKey: 'settings.general', icon: Building2 },
  { id: 'language', path: 'language', labelKey: 'settings.language', icon: Globe },
  { id: 'users', path: 'users', labelKey: 'settings.users', icon: Users },
  { id: 'userPermissions', path: 'userPermissions', labelKey: 'settings.userPermissions', icon: Key },
  { id: 'notifications', path: 'notifications', labelKey: 'settings.notifications', icon: Bell },
  { id: 'database', path: 'database', labelKey: 'settings.database', icon: Database },
  { id: 'devices', path: 'devices', labelKey: 'settings.connectedDevices', icon: Monitor },
  { id: 'backup', path: 'backup', labelKey: 'settings.backup', icon: HardDriveDownload },
  { id: 'about', path: 'about', labelKey: 'settings.about', icon: Info },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

export function getSectionByPath(path: string): (typeof SETTINGS_SECTIONS)[number] | undefined {
  return SETTINGS_SECTIONS.find((s) => s.path === path);
}
