"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Preload script for wallpaper window - exposes task APIs
 */
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('taskeroid', {
    getTasks: () => electron_1.ipcRenderer.invoke('get-tasks'),
    onTasksUpdate: (callback) => {
        electron_1.ipcRenderer.on('tasks-updated', (_event, tasks) => callback(tasks));
    },
    reportCollision: (taskId) => {
        electron_1.ipcRenderer.send('asteroid-collision', taskId);
    },
});
//# sourceMappingURL=wallpaper-preload.js.map