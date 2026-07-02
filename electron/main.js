const { app, BrowserWindow, ipcMain } = require('electron');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: __dirname + '/preload.js'
    },
    title: 'ShopOS - Desktop POS'
  });

  // Load production Vercel URL
  mainWindow.loadURL('https://shopmate-jet.vercel.app');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Print handler
ipcMain.handle('print-receipt', async (event, options) => {
  const { html, silent = false, printerName = null } = options;
  
  try {
    const printWindow = new BrowserWindow({ show: false });
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise(resolve => setTimeout(resolve, 500));

    const printOptions = {
      silent: silent,
      printBackground: true,
      color: false,
      pageSize: { width: 80000, height: 0 }
    };

    if (printerName) {
      printOptions.deviceName = printerName;
    }

    if (silent && printerName) {
      await printWindow.webContents.print(printOptions);
      printWindow.close();
      return { success: true, message: 'Printed successfully' };
    } else {
      return new Promise((resolve) => {
        printWindow.webContents.print(printOptions, (success, failureReason) => {
          printWindow.close();
          resolve({ 
            success: success, 
            message: success ? 'Printed successfully' : failureReason || 'Print cancelled' 
          });
        });
      });
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Get printers
ipcMain.handle('get-printers', async () => {
  try {
    if (mainWindow && mainWindow.webContents) {
      return await mainWindow.webContents.getPrintersAsync();
    }
    return [];
  } catch (error) {
    return [];
  }
});

console.log('ShopOS Desktop started');
