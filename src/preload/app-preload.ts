/**
 * Preload for main app window - exposes task APIs for scene + UI
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('taskeroid', {
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  onTasksUpdate: (callback: (tasks: unknown[]) => void) => {
    ipcRenderer.on('tasks-updated', (_event, tasks) => callback(tasks));
  },
  reportCollision: (taskId: string) => {
    ipcRenderer.send('asteroid-collision', taskId);
  },
});

contextBridge.exposeInMainWorld('taskeroidUI', {
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  addTask: (task: unknown) => ipcRenderer.invoke('add-task', task),
  updateTask: (id: string, updates: unknown) =>
    ipcRenderer.invoke('update-task', id, updates),
  deleteTask: (id: string) => ipcRenderer.invoke('delete-task', id),
  onTasksUpdate: (callback: (tasks: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tasks: unknown[]) =>
      callback(tasks);
    ipcRenderer.on('tasks-updated', handler);
    return () => ipcRenderer.removeListener('tasks-updated', handler);
  },
});
