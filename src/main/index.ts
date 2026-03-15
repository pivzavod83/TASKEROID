/**
 * Electron main process - Taskeroid app
 */
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import {
  getAllTasks,
  getTaskById,
  addTask,
  updateTask,
  deleteTask,
  closeDatabase,
  initDatabase,
  resetAndSeedDemo,
} from '../database/database';
import { Task } from '../models/task';

let mainWindow: BrowserWindow | null = null;

function getRepeatIntervalSec(repeatType: Task['repeat_type']): number {
  if (repeatType === 'daily') return 24 * 3600;
  if (repeatType === 'weekly') return 7 * 24 * 3600;
  return 0;
}

function computeNextRepeatingDeadline(currentDeadline: number, repeatType: Task['repeat_type']): number {
  const step = getRepeatIntervalSec(repeatType);
  if (!step) return currentDeadline;

  const now = Math.floor(Date.now() / 1000);
  let next = currentDeadline;
  while (next <= now) {
    next += step;
  }
  return next;
}

function createRepeatingClone(task: Task): Task {
  const nextDeadline = computeNextRepeatingDeadline(task.deadline, task.repeat_type);
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    title: task.title,
    importance: task.importance,
    deadline: nextDeadline,
    created_at: now,
    completed: false,
    depends_on: task.depends_on,
    repeat_type: task.repeat_type,
  };
}

function getIcon(): string | undefined {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    resizable: true,
    ...(getIcon() ? { icon: getIcon() } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/app-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const indexPath = path.join(__dirname, '../../index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function broadcastTasksUpdate(): void {
  const tasks = getAllTasks();
  mainWindow?.webContents.send('tasks-updated', tasks);
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
    depends_on: task.depends_on ?? null,
    repeat_type: task.repeat_type ?? 'none',
  };
  addTask(full);
  broadcastTasksUpdate();
  return full;
});

ipcMain.handle('update-task', (_event, id: string, updates: Partial<Task>) => {
  const before = getTaskById(id);
  const becameCompleted = before && !before.completed && updates.completed === true;

  if (before && becameCompleted && before.repeat_type !== 'none') {
    updateTask(id, {
      ...updates,
      completed: true,
    });
    addTask(createRepeatingClone(before));
  } else {
    updateTask(id, updates);
  }

  if (becameCompleted) {
    mainWindow?.webContents.send('task-completed', id);
  }

  broadcastTasksUpdate();
});

ipcMain.handle('delete-task', (_event, id: string) => {
  deleteTask(id);
  broadcastTasksUpdate();
});

ipcMain.on('asteroid-collision', (_e, taskId: string) => {
  broadcastTasksUpdate();
});

ipcMain.handle('window-control', (event, action: 'minimize' | 'toggle-maximize' | 'close') => {
  const win = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  if (!win) return false;

  if (action === 'minimize') {
    win.minimize();
    return win.isMaximized();
  }
  if (action === 'toggle-maximize') {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return win.isMaximized();
  }
  if (action === 'close') {
    win.close();
  }

  return win.isMaximized();
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await initDatabase();
  if (process.argv.includes('--demo')) {
    resetAndSeedDemo();
  }
  createMainWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase();
    app.quit();
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.focus();
  }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}
