"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Electron main process - wallpaper + task manager
 */
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const database_1 = require("../database/database");
let wallpaperWindow = null;
let uiWindow = null;
let tray = null;
const isDev = process.env.NODE_ENV === 'development';
function createWallpaperWindow() {
    wallpaperWindow = new electron_1.BrowserWindow({
        fullscreen: true,
        frame: false,
        transparent: false,
        skipTaskbar: true,
        show: false,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload/wallpaper-preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    wallpaperWindow.setFullScreen(true);
    wallpaperWindow.setAlwaysOnTop(false, 'normal');
    wallpaperWindow.setVisibleOnAllWorkspaces(true);
    wallpaperWindow.setFocusable(false);
    const wallpaperPath = path_1.default.join(__dirname, '../../wallpaper.html');
    wallpaperWindow.loadFile(wallpaperPath);
    wallpaperWindow.once('ready-to-show', () => {
        wallpaperWindow?.show();
    });
    wallpaperWindow.on('closed', () => {
        wallpaperWindow = null;
    });
}
function createUIWindow() {
    if (uiWindow) {
        uiWindow.focus();
        return;
    }
    uiWindow = new electron_1.BrowserWindow({
        width: 480,
        height: 640,
        resizable: true,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload/ui-preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    const uiPath = path_1.default.join(__dirname, '../../ui.html');
    uiWindow.loadFile(uiPath);
    uiWindow.on('closed', () => {
        uiWindow = null;
    });
}
function broadcastTasksUpdate() {
    const tasks = (0, database_1.getAllTasks)();
    wallpaperWindow?.webContents.send('tasks-updated', tasks);
    uiWindow?.webContents.send('tasks-updated', tasks);
}
electron_1.ipcMain.handle('get-tasks', () => (0, database_1.getAllTasks)());
electron_1.ipcMain.handle('add-task', (_event, task) => {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);
    const full = {
        id,
        title: task.title,
        importance: Math.max(1, Math.min(5, task.importance)),
        deadline: task.deadline,
        created_at: now,
        completed: task.completed ?? false,
    };
    (0, database_1.addTask)(full);
    broadcastTasksUpdate();
    return full;
});
electron_1.ipcMain.handle('update-task', (_event, id, updates) => {
    (0, database_1.updateTask)(id, updates);
    broadcastTasksUpdate();
});
electron_1.ipcMain.handle('delete-task', (_event, id) => {
    (0, database_1.deleteTask)(id);
    broadcastTasksUpdate();
});
electron_1.ipcMain.on('asteroid-collision', (_e, taskId) => {
    broadcastTasksUpdate();
});
function setupTray() {
    const iconPath = path_1.default.join(__dirname, '../../assets/tray-icon.png');
    let icon = electron_1.nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
        icon = electron_1.nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2NkYGD4z0ABYBzVMKoBagbQgAGjGhi1AWqBoRoY1YCaBqgZQBMLRhUxMjL+BwBFwhINs2oK2QAAAABJRU5ErkJggg==');
    }
    tray = new electron_1.Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('Taskeroid - Click to open Task Manager');
    tray.on('click', () => createUIWindow());
}
electron_1.app.whenReady().then(async () => {
    await (0, database_1.initDatabase)();
    if (process.argv.includes('--demo')) {
        (0, database_1.resetAndSeedDemo)();
    }
    createWallpaperWindow();
    if (process.platform !== 'linux') {
        try {
            setupTray();
        }
        catch { /* no tray */ }
    }
    if (process.argv.includes('--open-ui')) {
        createUIWindow();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWallpaperWindow();
    }
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        (0, database_1.closeDatabase)();
        electron_1.app.quit();
    }
});
electron_1.app.on('second-instance', () => {
    createUIWindow();
});
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
// Run at startup (optional - user can enable in settings later)
electron_1.app.setLoginItemSettings({ openAtLogin: false });
//# sourceMappingURL=index.js.map