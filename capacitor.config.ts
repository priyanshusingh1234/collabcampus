import type { CapacitorConfig } from '@capacitor/cli';

// Use an environment variable to point the web app URL when running inside the native shell.
// Example: set CAP_SERVER_URL=https://your-domain.example
const serverUrl = process.env.CAP_SERVER_URL || undefined;

const config: CapacitorConfig = {
  appId: 'com.collabcampus.app',
  appName: 'CollabCampus',
  bundledWebRuntime: false,
  webDir: '.next', // not used when server.url is set
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: false,
      }
    : {
        androidScheme: 'https',
      },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: true,
  },
};

export default config;
