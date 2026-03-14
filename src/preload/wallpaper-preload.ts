/**
 * Preload script for wallpaper window - exposes task APIs
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
