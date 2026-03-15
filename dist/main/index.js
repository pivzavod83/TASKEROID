"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Electron main process - Taskeroid app
 */
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = require("../database/database");
let mainWindow = null;
function getIcon() {
    const iconPath = path_1.default.join(__dirname, '../../assets/icon.png');
    return fs_1.default.existsSync(iconPath) ? iconPath : undefined;
}
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
            preload: path_1.default.join(__dirname, '../preload/app-preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    const indexPath = path_1.default.join(__dirname, '../../index.html');
    mainWindow.loadFile(indexPath);
    mainWindow.once('ready-to-show', () => {
        mainWindow?.maximize();
        mainWindow?.show();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function broadcastTasksUpdate() {
    const tasks = (0, database_1.getAllTasks)();
    mainWindow?.webContents.send('tasks-updated', tasks);
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
electron_1.ipcMain.handle('window-control', (event, action) => {
    const win = electron_1.BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    if (!win)
        return false;
    if (action === 'minimize') {
        win.minimize();
        return win.isMaximized();
    }
    if (action === 'toggle-maximize') {
        if (win.isMaximized()) {
            win.unmaximize();
        }
        else {
            win.maximize();
        }
        return win.isMaximized();
    }
    if (action === 'close') {
        win.close();
    }
    return win.isMaximized();
});
electron_1.app.whenReady().then(async () => {
    electron_1.Menu.setApplicationMenu(null);
    await (0, database_1.initDatabase)();
    if (process.argv.includes('--demo')) {
        (0, database_1.resetAndSeedDemo)();
    }
    createMainWindow();
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        (0, database_1.closeDatabase)();
        electron_1.app.quit();
    }
});
electron_1.app.on('second-instance', () => {
    if (mainWindow) {
        mainWindow.focus();
    }
});
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
//# sourceMappingURL=index.js.map