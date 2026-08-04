import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d997c798f68f4ab19e11a2d43c7a1cb3',
  appName: '4D Academy Hub',
  webDir: 'dist',
  server: {
    cleartext: true,
    url: 'https://d997c798-f68f-4ab1-9e11-a2d43c7a1cb3.lovableproject.com?forceHideBadge=true',
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
