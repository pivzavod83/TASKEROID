import React, { useState } from 'react';
import type { TaskData } from './types';

interface TaskItemProps {
  task: TaskData;
  tasks: TaskData[];
  focusTaskId: string | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onFocus: () => void;
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

function urgencyClass(deadline: number): string {
  const secLeft = deadline - Date.now() / 1000;
  if (secLeft < 0) return 'urgency-overdue';
  if (secLeft < 3600 * 6) return 'urgency-critical';
  if (secLeft < 3600 * 24) return 'urgency-warning';
  return '';
}

function formatDeadline(ts: number): string {
  const d = new Date(ts * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function formatTimeRemaining(ts: number): string {
  const secLeft = ts - Date.now() / 1000;
  if (secLeft < 0) return 'OVERDUE';
  const days = Math.floor(secLeft / 86400);
  const hours = Math.floor((secLeft % 86400) / 3600);
  return `T−${String(days).padStart(2, '0')}D ${String(hours).padStart(2, '0')}H`;
}

function ImportancePips({ value }: { value: number }) {
  return (
    <div className="importance-bar">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className={`importance-pip${n <= value ? ' active' : ''}`} />
      ))}
    </div>
  );
}

export function TaskItem({
  task,
  tasks,
  focusTaskId,
  isEditing,
  onStartEdit,
  onEndEdit,
  onComplete,
  onDelete,
  onFocus,
  onClearFocus,
  onEdit,
}: TaskItemProps): React.ReactElement {
  const [title, setTitle] = useState(task.title);
  const [importance, setImportance] = useState(task.importance);
  const [deadline, setDeadline] = useState(
    new Date(task.deadline * 1000).toISOString().slice(0, 10)
  );
  const [dependsOn, setDependsOn] = useState(task.depends_on ?? '');
  const [repeatType, setRepeatType] = useState<TaskData['repeat_type']>(task.repeat_type ?? 'none');

  const isLocked = task.isUnlocked === false;
  const isFocused = focusTaskId === task.id;
  const isDimmed = focusTaskId !== null && !isFocused;

  const handleSave = () => {
    const d = Math.floor(new Date(`${deadline}T23:59:59`).getTime() / 1000);
    onEdit(task.id, {
      title,
      importance,
      deadline: d,
      depends_on: dependsOn || null,
      repeat_type: repeatType,
    });
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
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <select value={dependsOn} onChange={(e) => setDependsOn(e.target.value)}>
          <option value="">No dependency</option>
          {tasks
            .filter((candidate) => !candidate.completed && candidate.id !== task.id)
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
        </select>
        <select
          value={repeatType}
          onChange={(e) => setRepeatType(e.target.value as TaskData['repeat_type'])}
        >
          <option value="none">No repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <div className="actions">
          <button onClick={handleSave}>Save</button>
          <button onClick={onEndEdit}>Cancel</button>
        </div>
      </li>
    );
  }

  const urg = urgencyClass(task.deadline);
  return (
    <li className={`task-item${urg ? ' ' + urg : ''}${isDimmed ? ' focus-dimmed' : ''}${isFocused ? ' focus-active' : ''}${isLocked ? ' task-locked' : ''}`}>
      <div className="task-item-header">
        <span className="title">{task.title}</span>
        <ImportancePips value={task.importance} />
      </div>
      <span className="meta">
        DUE&nbsp;<span className="deadline-value">{formatDeadline(task.deadline)}</span>
        &nbsp;&nbsp;ETA&nbsp;<span className="deadline-value">{formatTimeRemaining(task.deadline)}</span>
      </span>
      <span className="meta">
        {isLocked ? 'CHAIN LOCKED' : 'CHAIN READY'}
        {task.repeat_type !== 'none' ? `  //  REPEAT ${task.repeat_type.toUpperCase()}` : ''}
      </span>
      <div className="actions">
        <button onClick={onComplete} disabled={isLocked}>&#9689; CONFIRM</button>
        {isFocused ? (
          <button onClick={onClearFocus}>UNFOCUS</button>
        ) : (
          <button onClick={onFocus}>FOCUS</button>
        )}
        <button onClick={onStartEdit}>&#9998; EDIT</button>
        <button onClick={onDelete} className="delete">&#10005; DESTROY</button>
      </div>
    </li>
  );
}
