// Главный процесс Electron: окно программы и работа с файлами схемы.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const ai = require('./ai');

// Своя папка для данных: на Windows это %APPDATA%\agent-studio
app.setPath('userData', path.join(app.getPath('appData'), 'agent-studio'));

const schemaPath = () => path.join(app.getPath('userData'), 'schema.json');

async function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, file);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'Студия агентов',
    backgroundColor: '#101318',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Внешние ссылки открываем в обычном браузере, а не внутри программы.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

ipcMain.handle('schema:load', async () => {
  try {
    return JSON.parse(await fs.readFile(schemaPath(), 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('schema:save', async (_e, data) => {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await writeAtomic(schemaPath(), JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('schema:export', async (e, data) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Сохранить схему',
    defaultPath: 'схема-агентов.json',
    filters: [{ name: 'Схема агентов', extensions: ['json'] }],
  });
  if (canceled || !filePath) return false;
  await writeAtomic(filePath, JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('schema:import', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Открыть схему',
    properties: ['openFile'],
    filters: [{ name: 'Схема агентов', extensions: ['json'] }],
  });
  if (canceled || !filePaths.length) return null;
  return JSON.parse(await fs.readFile(filePaths[0], 'utf8'));
});

ipcMain.handle('key:status', () => ai.keyStatus());
ipcMain.handle('key:set', (_e, key) => ai.setKey(key));
ipcMain.handle('key:clear', () => ai.clearKey());
ipcMain.handle('agent:run', (e, req) => ai.runAgent(e.sender, req));
ipcMain.handle('agent:abort', (_e, runId) => ai.abortAgent(runId));

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
