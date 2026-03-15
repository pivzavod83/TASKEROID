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
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'mission' | 'tasks'>('mission');

  useEffect(() => {
    const api = window.taskeroidUI;
    if (!api) return;
    api.getTasks().then(setTasks);
    const unsub = api.onTasksUpdate(setTasks);
    return unsub;
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('taskeroid-focus', { detail: { taskId: focusTaskId } }));
  }, [focusTaskId]);

  useEffect(() => {
    if (focusTaskId && !tasks.some((task) => task.id === focusTaskId)) {
      setFocusTaskId(null);
    }
  }, [focusTaskId, tasks]);

  const handleAdd = async (
    title: string,
    importance: number,
    deadline: number,
    depends_on: string | null,
    repeat_type: TaskData['repeat_type']
  ) => {
    await window.taskeroidUI?.addTask({
      title,
      importance,
      deadline,
      completed: false,
      depends_on,
      repeat_type,
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
    updates: {
      title?: string;
      importance?: number;
      deadline?: number;
      depends_on?: string | null;
      repeat_type?: TaskData['repeat_type'];
    }
  ) => {
    await window.taskeroidUI?.updateTask(id, updates);
  };

  return (
    <div className="app">
      <div className="main-tabs" role="tablist" aria-label="Main navigation tabs">
        <button
          type="button"
          className={`main-tab${activeTab === 'mission' ? ' active' : ''}`}
          onClick={() => setActiveTab('mission')}
        >
          Mission Input
        </button>
        <button
          type="button"
          className={`main-tab${activeTab === 'tasks' ? ' active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Current Tasks
        </button>
      </div>

      {activeTab === 'mission' ? (
        <>
          <header>
              <div className="hud-bar">
                <span className="hud-logo">TASKEROID</span>
                <span className="hud-status">
                  <span className="hud-status-dot"></span>SYS ONLINE
                </span>
              </div>
              <p>ORBITAL THREAT MONITOR // ASTEROID TRACKING SYSTEM</p>
          </header>
          <TaskForm onSubmit={handleAdd} tasks={tasks} />
        </>
      ) : (
        <TaskList
          tasks={tasks}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onEdit={handleEdit}
          focusTaskId={focusTaskId}
          onFocusTask={(taskId) => setFocusTaskId(taskId)}
          onClearFocus={() => setFocusTaskId(null)}
        />
      )}
    </div>
  );
}
