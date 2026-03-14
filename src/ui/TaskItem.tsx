import React, { useState } from 'react';
import type { TaskData } from './types';

interface TaskItemProps {
  task: TaskData;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: (
    id: string,
    u: { title?: string; importance?: number; deadline?: number }
  ) => void;
}

function formatDeadline(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export function TaskItem({
  task,
  isEditing,
  onStartEdit,
  onEndEdit,
  onComplete,
  onDelete,
  onEdit,
}: TaskItemProps): React.ReactElement {
  const [title, setTitle] = useState(task.title);
  const [importance, setImportance] = useState(task.importance);
  const [deadline, setDeadline] = useState(
    new Date(task.deadline * 1000).toISOString().slice(0, 16)
  );

  const handleSave = () => {
    const d = Math.floor(new Date(deadline).getTime() / 1000);
    onEdit(task.id, { title, importance, deadline: d });
    onEndEdit();
  };

  if (isEditing) {
    return (
      <li className="task-item editing">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        <input
          type="number"
          min={1}
          max={5}
          value={importance}
          onChange={(e) => setImportance(Number(e.target.value))}
        />
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <div className="actions">
          <button onClick={handleSave}>Save</button>
          <button onClick={onEndEdit}>Cancel</button>
        </div>
      </li>
    );
  }

  return (
    <li className="task-item">
      <span className="title">{task.title}</span>
      <span className="meta">
        Importance: {task.importance} · Due: {formatDeadline(task.deadline)}
      </span>
      <div className="actions">
        <button onClick={onComplete}>Complete</button>
        <button onClick={onStartEdit}>Edit</button>
        <button onClick={onDelete} className="delete">
          Delete
        </button>
      </div>
    </li>
  );
}
