import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV !== 'production';

const config: CapacitorConfig = {
  appId: 'app.lovable.ordb',
  appName: 'ORDB',
  webDir: 'dist',
  plugins: {
    CapacitorCookies: {
      enabled: true
    },
    CapacitorSQLite: {
      enabled: true
    }
  },
  ...(isDev ? {
    server: {
      url: 'https://4f0f9990-c3c0-4e04-9ceb-2c41704d227e.lovableproject.com?forceHideBadge=true',
      cleartext: true
    }
  } : {})
};

export default config;
