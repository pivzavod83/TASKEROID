import React, { useState } from 'react';
import type { TaskData } from './types';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: TaskData[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  focusTaskId: string | null;
  onFocusTask: (id: string) => void;
  onClearFocus: () => void;
  onEdit: (
    id: string,
    u: {
      title?: string;
      importance?: number;
      deadline?: number;
      depends_on?: string | null;
      repeat_type?: TaskData['repeat_type'];
    }
  ) => void;
}

export function TaskList({
  tasks,
  onComplete,
  onDelete,
  focusTaskId,
  onFocusTask,
  onClearFocus,
  onEdit,
}: TaskListProps): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null);
  const activeTasks = tasks.filter((t) => !t.completed);

  return (
    <ul className="task-list">
      {activeTasks.length === 0 ? (
        <li className="empty">No tasks yet. Add one above!</li>
      ) : (
        activeTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            tasks={activeTasks}
            focusTaskId={focusTaskId}
            isEditing={editingId === task.id}
            onStartEdit={() => setEditingId(task.id)}
            onEndEdit={() => setEditingId(null)}
            onComplete={() => onComplete(task.id)}
            onDelete={() => onDelete(task.id)}
            onFocus={() => onFocusTask(task.id)}
            onClearFocus={onClearFocus}
            onEdit={onEdit}
          />
        ))
      )}
    </ul>
  );
}
