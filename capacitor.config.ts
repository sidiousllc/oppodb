import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ordb',
  appName: 'ordb',
  webDir: 'dist',
  server: {
    url: 'https://4f0f9990-c3c0-4e04-9ceb-2c41704d227e.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
