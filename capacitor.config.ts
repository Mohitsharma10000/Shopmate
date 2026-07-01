import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shopmate.pro',
  appName: 'ShopOS',
  webDir: '.output/public',
  server: {
    url: 'https://shopmate-jet.vercel.app',
    cleartext: true
  }
};

export default config;
