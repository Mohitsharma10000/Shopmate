// Simple script to package Electron app
const builder = require('electron-builder');
const path = require('path');

console.log('Building ShopOS Desktop...\n');

builder.build({
  projectDir: path.join(__dirname, 'electron'),
  config: {
    appId: 'com.shopos.desktop',
    productName: 'ShopOS',
    directories: {
      output: path.join(__dirname, 'shopos-build')
    },
    files: [
      '**/*',
      '!node_modules'
    ],
    win: {
      target: ['dir'],  // Just create unpacked folder, not installer
      icon: path.join(__dirname, 'public', 'favicon.png')
    }
  }
}).then(() => {
  console.log('\n✅ Build complete!');
  console.log('\nApp folder created:');
  console.log('  📦 shopos-build\\win-unpacked\\ShopOS.exe');
  console.log('\nYou can ZIP the win-unpacked folder and share it!');
}).catch((error) => {
  console.error('\n❌ Build failed:', error);
  process.exit(1);
});
