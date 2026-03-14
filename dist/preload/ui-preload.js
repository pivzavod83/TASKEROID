"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Preload script for task manager UI
 */
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('taskeroidUI', {
    getTasks: () => electron_1.ipcRenderer.invoke('get-tasks'),
    addTask: (task) => electron_1.ipcRenderer.invoke('add-task', task),
    updateTask: (id, updates) => electron_1.ipcRenderer.invoke('update-task', id, updates),
    deleteTask: (id) => electron_1.ipcRenderer.invoke('delete-task', id),
    onTasksUpdate: (callback) => {
        const handler = (_event, tasks) => callback(tasks);
        electron_1.ipcRenderer.on('tasks-updated', handler);
        return () => electron_1.ipcRenderer.removeListener('tasks-updated', handler);
    },
});
//# sourceMappingURL=ui-preload.js.map