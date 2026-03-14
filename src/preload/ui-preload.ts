/**
 * Preload script for task manager UI
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('taskeroidUI', {
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  addTask: (task: unknown) => ipcRenderer.invoke('add-task', task),
  updateTask: (id: string, updates: unknown) => ipcRenderer.invoke('update-task', id, updates),
  deleteTask: (id: string) => ipcRenderer.invoke('delete-task', id),
  onTasksUpdate: (callback: (tasks: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tasks: unknown[]) => callback(tasks);
    ipcRenderer.on('tasks-updated', handler);
    return () => ipcRenderer.removeListener('tasks-updated', handler);
  },
});
