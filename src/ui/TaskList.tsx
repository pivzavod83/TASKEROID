import React, { useState } from 'react';
import type { TaskData } from './types';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: TaskData[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (
    id: string,
    u: { title?: string; importance?: number; deadline?: number }
  ) => void;
}

export function TaskList({
  tasks,
  onComplete,
  onDelete,
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
            isEditing={editingId === task.id}
            onStartEdit={() => setEditingId(task.id)}
            onEndEdit={() => setEditingId(null)}
            onComplete={() => onComplete(task.id)}
            onDelete={() => onDelete(task.id)}
            onEdit={onEdit}
          />
        ))
      )}
    </ul>
  );
}
