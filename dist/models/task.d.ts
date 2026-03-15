/**
 * Task model - each task maps to an asteroid in the wallpaper
 */
export interface Task {
    id: string;
    title: string;
    importance: number;
    deadline: number;
    created_at: number;
    completed: boolean;
    depends_on: string | null;
    repeat_type: 'none' | 'daily' | 'weekly';
    isUnlocked?: boolean;
}
export interface CreateTaskInput {
    title: string;
    importance: number;
    deadline: number;
    depends_on?: string | null;
    repeat_type?: 'none' | 'daily' | 'weekly';
}
export interface UpdateTaskInput {
    title?: string;
    importance?: number;
    deadline?: number;
    completed?: boolean;
    depends_on?: string | null;
    repeat_type?: 'none' | 'daily' | 'weekly';
}
//# sourceMappingURL=task.d.ts.map