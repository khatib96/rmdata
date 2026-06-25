import { app } from 'electron';

/** Force Chromium to prefer macOS CoreLocation when renderer geolocation is used. */
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch(
    'enable-features',
    'MacCoreLocationBackend,LocationProviderManager:LocationProviderManagerMode/PlatformOnly',
  );
}
