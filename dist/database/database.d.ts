import { Task } from '../models/task';
export declare function getAllTasks(): Task[];
export declare function addTask(task: Task): void;
export declare function updateTask(id: string, updates: Partial<Pick<Task, 'title' | 'importance' | 'deadline' | 'completed'>>): void;
export declare function deleteTask(id: string): void;
export declare function getTaskById(id: string): Task | null;
export declare function seedDemoIfEmpty(): void;
export declare function resetAndSeedDemo(): void;
export declare function initDatabase(): Promise<void>;
export declare function closeDatabase(): void;
//# sourceMappingURL=database.d.ts.map