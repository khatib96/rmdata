import { BrowserWindow, Tray } from 'electron';

export type RemoteApiSession = {
  token: string;
  apiBaseUrl: string;
  userId?: number;
};

export const sharedState = {
  mainWindow: null as BrowserWindow | null,
  splashWindow: null as BrowserWindow | null,
  tray: null as Tray | null,
  lastUnreadCount: -1,
  updateDownloaded: false,
  currentSessionToken: null as string | null,
  remoteApiSession: null as RemoteApiSession | null,
  isDev: process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged,
};

export function setMainWindow(win: BrowserWindow | null) { sharedState.mainWindow = win; }
export function setSplashWindow(win: BrowserWindow | null) { sharedState.splashWindow = win; }
export function setTray(t: Tray | null) { sharedState.tray = t; }
export function setLastUnreadCount(count: number) { sharedState.lastUnreadCount = count; }
export function setUpdateDownloaded(val: boolean) { sharedState.updateDownloaded = val; }
export function setCurrentSessionToken(token: string | null) { sharedState.currentSessionToken = token; }
export function setRemoteApiSession(session: RemoteApiSession | null) { sharedState.remoteApiSession = session; }
