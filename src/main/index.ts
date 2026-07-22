import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BrowserWindow, app, ipcMain, shell } from 'electron';
import type { EventPayloads } from '@core/protocol';
import { GameHost } from './gameHost';

// In development all runtime data stays inside the repo (.dev-data/), keeping
// the host machine clean; packaged builds use the standard userData location.
if (!app.isPackaged) {
  app.setPath('userData', resolve(__dirname, '../../.dev-data'));
}

let host: GameHost | null = null;

function broadcast<C extends keyof EventPayloads>(channel: C, payload: EventPayloads[C]): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#12141c',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.on('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Verification hook: SWAY_SCREENSHOT=/path.png captures the window after
  // load and exits — lets headless tooling confirm the app renders.
  if (process.env['SWAY_SCREENSHOT']) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        void window.webContents.capturePage().then((image) => {
          writeFileSync(process.env['SWAY_SCREENSHOT'] as string, image.toPNG());
          app.quit();
        });
      }, 2500);
    });
  }

  if (process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  host = new GameHost(app.getPath('userData'), broadcast);
  ipcMain.handle('app:invoke', (_event, channel: string, payload: unknown) =>
    host?.handle(channel, payload),
  );
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
