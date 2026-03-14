import React, { useEffect, useState } from 'react';
import { TaskList } from './TaskList';
import { TaskForm } from './TaskForm';
import type { TaskData } from './types';

declare const window: Window & {
  taskeroidUI?: {
    getTasks: () => Promise<TaskData[]>;
    addTask: (t: Omit<TaskData, 'id' | 'created_at'>) => Promise<TaskData>;
    updateTask: (id: string, u: Partial<TaskData>) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    onTasksUpdate: (cb: (t: TaskData[]) => void) => () => void;
  };
};

export function App(): React.ReactElement {
  const [tasks, setTasks] = useState<TaskData[]>([]);

  useEffect(() => {
    const api = window.taskeroidUI;
    if (!api) return;
    api.getTasks().then(setTasks);
    const unsub = api.onTasksUpdate(setTasks);
    return unsub;
  }, []);

  const handleAdd = async (title: string, importance: number, deadline: number) => {
    await window.taskeroidUI?.addTask({
      title,
      importance,
      deadline,
      completed: false,
    });
  };

  const handleComplete = async (id: string) => {
    await window.taskeroidUI?.updateTask(id, { completed: true });
  };

  const handleDelete = async (id: string) => {
    await window.taskeroidUI?.deleteTask(id);
  };

  const handleEdit = async (
    id: string,
    updates: { title?: string; importance?: number; deadline?: number }
  ) => {
    await window.taskeroidUI?.updateTask(id, updates);
  };

  return (
    <div className="app">
      <header>
        <h1>Taskeroid</h1>
        <p>Tasks appear as asteroids approaching the planet</p>
      </header>
      <TaskForm onSubmit={handleAdd} />
      <TaskList
        tasks={tasks}
        onComplete={handleComplete}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    </div>
  );
}
