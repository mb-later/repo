/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater, AppUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { spawn, exec } from 'child_process';
import fs from 'fs';
const cfx = require("cfx-api");
const REDM_SERVER_IP = '194.107.126.204'; // Örnek bir IP adresi
const REDM_SERVER_PORT = 30120;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let redmExePath: string | null = null;
let mainWindow: BrowserWindow | null = null;
try {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  const data = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(data);
  redmExePath = config.redmExePath || null;
} catch (err) {
  console.error('Error reading config file:', err);
}
ipcMain.on('ipc-example', async (event, arg) => {
  if (redmExePath) {
    connectToServer()
  } else {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Executable Files', extensions: ['exe'] }],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      redmExePath = result.filePaths[0];
      try {
        const configPath = path.join(app.getPath('userData'), 'config.json');
        fs.writeFileSync(configPath, JSON.stringify({ redmExePath }));
      } catch (err) {
        console.error('Error writing config file:', err);
      }
      connectToServer()
    }
  }
});

async function connectToServer() {
  const redMProcess = spawn(redmExePath);
  // const server = await cfx.fetchServer("8y47k5"); // Replace "qrpm7v" with a server id
  // console.group(JSON.stringify(server))
  // console.log(`Server: ${server.hostname} has ${server.players.length} players online`);
  redMProcess.on('spawn', () => {
    setTimeout(() => {
      const connectCommand = `${redmExePath} fivem://connect/${REDM_SERVER_IP}:${REDM_SERVER_PORT}`;
      exec(`start ${connectCommand}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing shell command: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`Error output: ${stderr}`);
          return;
        }
        console.log(`Connected to ${REDM_SERVER_IP}:${REDM_SERVER_PORT}`);
      });
    }, 15000); // 3 saniye bekleyerek konsolun tamamen açılmasını sağlayalım
  });
}

// ipcMain.on('ipc-example', async (event, arg) => {
//   const programPath = 'C:/Users/unutu/AppData/Local/RedM/RedM.exe';
//   const childProcess = spawn(programPath, []);
//   childProcess.on('spawn', () => {
//     childProcess.stdin.write('connect localhost\n');
//     const msgTemplate = (result: string) => `IPC test: ${result}`;
//     event.reply('ipc-example', msgTemplate('RedM başlatıldı ve sunucuya bağlanıldı'));
//   });

//   childProcess.stdout.on('data', (data) => {
//     console.log(`RedM çıktı: ${data}`);
//   });

//   childProcess.stderr.on('data', (data) => {
//     console.error(`RedM hata: ${data}`);
//   });
//   childProcess.on('error', (err) => {
//     console.error('Uygulama başlatılamadı:', err);
//     event.reply('ipc-example', 'Uygulama başlatılamadı');
//   });
// });

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};


const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1400,
    height: 768,
    resizable: false,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
    frame: false, // Çerçeveyi kapat
    transparent: true, // Saydam arka plan
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
  new AppUpdater();
};

app.on('ready', () => {
  console.log("ready")
  autoUpdater.setFeedURL({
      provider: 'github',
      repo: 'repo',
      owner: 'mb-later',
      token: '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'
  });
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
  const dialogOpts = {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Application Update',
    message: process.platform === 'win32' ? releaseNotes : releaseName,
    detail:
      'A new version has been downloaded. Restart the application to apply the updates.'
  };
  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) autoUpdater.quitAndInstall()
  })
})

autoUpdater.on('error', (message) => {
  console.error('There was a problem updating the application')
  console.error(message);
})
/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
