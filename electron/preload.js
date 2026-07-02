const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printReceipt: (options) => ipcRenderer.invoke('print-receipt', options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getDefaultPrinter: () => ipcRenderer.invoke('get-default-printer'),
  setDefaultPrinter: (printerName) => ipcRenderer.invoke('set-default-printer', printerName),
  platform: process.platform,
  isElectron: true
});
