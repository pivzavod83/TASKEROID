/**
 * Electron main process - wallpaper + task manager
 */
import { app, BrowserWindow, ipcMain, Tray, nativeImage } from 'electron';
import path from 'path';
import {
  getAllTasks,
  addTask,
  updateTask,
  deleteTask,
  closeDatabase,
  initDatabase,
  resetAndSeedDemo,
} from '../database/database';
import { Task } from '../models/task';

let wallpaperWindow: BrowserWindow | null = null;
let uiWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWallpaperWindow(): void {
  wallpaperWindow = new BrowserWindow({
    fullscreen: true,
    frame: false,
    transparent: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/wallpaper-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  wallpaperWindow.setFullScreen(true);
  wallpaperWindow.setAlwaysOnTop(false, 'normal');
  wallpaperWindow.setVisibleOnAllWorkspaces(true);
  wallpaperWindow.setFocusable(false);

  const wallpaperPath = path.join(__dirname, '../../wallpaper.html');
  wallpaperWindow.loadFile(wallpaperPath);

  wallpaperWindow.once('ready-to-show', () => {
    wallpaperWindow?.show();
  });

  wallpaperWindow.on('closed', () => {
    wallpaperWindow = null;
  });
}

function createUIWindow(): void {
  if (uiWindow) {
    uiWindow.focus();
    return;
  }

  uiWindow = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/ui-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const uiPath = path.join(__dirname, '../../ui.html');
  uiWindow.loadFile(uiPath);

  uiWindow.on('closed', () => {
    uiWindow = null;
  });
}

function broadcastTasksUpdate(): void {
  const tasks = getAllTasks();
  wallpaperWindow?.webContents.send('tasks-updated', tasks);
  uiWindow?.webContents.send('tasks-updated', tasks);
}

ipcMain.handle('get-tasks', () => getAllTasks());

ipcMain.handle('add-task', (_event, task: Omit<Task, 'id' | 'created_at'>) => {
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Math.floor(Date.now() / 1000);
  const full: Task = {
    id,
    title: task.title,
    importance: Math.max(1, Math.min(5, task.importance)),
    deadline: task.deadline,
    created_at: now,
    completed: task.completed ?? false,
  };
  addTask(full);
  broadcastTasksUpdate();
  return full;
});

ipcMain.handle('update-task', (_event, id: string, updates: Partial<Task>) => {
  updateTask(id, updates);
  broadcastTasksUpdate();
});

ipcMain.handle('delete-task', (_event, id: string) => {
  deleteTask(id);
  broadcastTasksUpdate();
});

ipcMain.on('asteroid-collision', (_e, taskId: string) => {
  broadcastTasksUpdate();
});

function setupTray(): void {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2NkYGD4z0ABYBzVMKoBagbQgAGjGhi1AWqBoRoY1YCaBqgZQBMLRhUxMjL+BwBFwhINs2oK2QAAAABJRU5ErkJggg=='
    );
  }
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Taskeroid - Click to open Task Manager');
  tray.on('click', () => createUIWindow());
}

app.whenReady().then(async () => {
  await initDatabase();
  if (process.argv.includes('--demo')) {
    resetAndSeedDemo();
  }
  createWallpaperWindow();
  if (process.platform !== 'linux') {
    try { setupTray(); } catch { /* no tray */ }
  }
  if (process.argv.includes('--open-ui')) {
    createUIWindow();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWallpaperWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase();
    app.quit();
  }
});

app.on('second-instance', () => {
  createUIWindow();
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Run at startup (optional - user can enable in settings later)
app.setLoginItemSettings({ openAtLogin: false });
