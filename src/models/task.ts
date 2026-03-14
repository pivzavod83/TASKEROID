/**
 * Task model - each task maps to an asteroid in the wallpaper
 */
export interface Task {
  id: string;
  title: string;
  importance: number; // 1-5, required
  deadline: number;   // Unix timestamp
  created_at: number;
  completed: boolean;
}

export interface CreateTaskInput {
  title: string;
  importance: number;
  deadline: number;
}

export interface UpdateTaskInput {
  title?: string;
  importance?: number;
  deadline?: number;
  completed?: boolean;
}
