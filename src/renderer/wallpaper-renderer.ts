/**
 * Wallpaper renderer entry - runs in wallpaper BrowserWindow
 */
import {
  initWallpaper,
  setTasks,
  stopWallpaper,
  playTaskCompleteAnimation,
} from './wallpaper-loop';

declare const window: Window & {
  taskeroid?: {
    getTasks: () => Promise<unknown[]>;
    onTasksUpdate: (callback: (tasks: unknown[]) => void) => void;
    onTaskCompleted?: (callback: (taskId: string) => void) => (() => void) | void;
    reportCollision?: (taskId: string) => void;
  };
};

const canvas = document.getElementById('wallpaper-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

interface TaskData {
  id: string;
  title: string;
  importance: number;
  deadline: number;
  created_at: number;
  completed: boolean;
}

function loadTasks(): void {
  if (!window.taskeroid?.getTasks) return;
  window.taskeroid.getTasks().then((tasks) => {
    setTasks((tasks || []) as TaskData[]);
  });
}

initWallpaper(canvas, (taskId) => {
  window.taskeroid?.reportCollision?.(taskId);
});

loadTasks();
window.taskeroid?.onTasksUpdate?.((tasks) => {
  setTasks((tasks || []) as TaskData[]);
});

window.taskeroid?.onTaskCompleted?.((taskId) => {
  playTaskCompleteAnimation(taskId);
});

window.addEventListener('beforeunload', stopWallpaper);
