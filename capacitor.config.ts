import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shopmate.pro',
  appName: 'ShopOS',
  webDir: '.output/public',
  server: {
    // -----------------------------------------------------------------------------------
    // PRODUCTION MODE: Replace this URL with your live deployed website URL
    // (e.g., https://your-app.vercel.app or https://your-project.lovable.app)
    // -----------------------------------------------------------------------------------
    url: 'https://shopos-pro.lovable.app',
    
    // -----------------------------------------------------------------------------------
    // DEVELOPMENT/TESTING MODE: Uncomment the line below to connect to your local computer's IP
    // url: 'http://192.168.1.100:3000',
    // -----------------------------------------------------------------------------------
    
    cleartext: true
  }
};

export default config;
