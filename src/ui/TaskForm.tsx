import React, { useState } from 'react';
import type { TaskData } from './types';

interface TaskFormProps {
  onSubmit: (
    title: string,
    importance: number,
    deadline: number,
    dependsOn: string | null,
    repeatType: TaskData['repeat_type']
  ) => void;
  tasks: TaskData[];
}

export function TaskForm({ onSubmit, tasks }: TaskFormProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [importance, setImportance] = useState(3);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [dependsOn, setDependsOn] = useState<string>('');
  const [repeatType, setRepeatType] = useState<TaskData['repeat_type']>('none');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const d = deadlineDate || new Date().toISOString().slice(0, 10);
    const deadline = Math.floor(new Date(`${d}T23:59:59`).getTime() / 1000);
    onSubmit(title.trim(), importance, deadline, dependsOn || null, repeatType);
    setTitle('');
    setImportance(3);
    setDependsOn('');
    setRepeatType('none');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDeadlineDate(tomorrow.toISOString().slice(0, 10));
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        type="text"
          placeholder="TARGET DESIGNATION"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="form-row">
        <label>
           // PRIORITY
          <input
            type="number"
            min={1}
            max={5}
            value={importance}
            onChange={(e) => setImportance(Number(e.target.value))}
          />
        </label>
        <label>
           // DATE
          <input
            type="date"
            value={deadlineDate || defaultDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
           // DEPENDS ON
          <select value={dependsOn} onChange={(e) => setDependsOn(e.target.value)}>
            <option value="">NONE</option>
            {tasks
              .filter((task) => !task.completed)
              .map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
          </select>
        </label>
        <label>
           // REPEAT
          <select
            value={repeatType}
            onChange={(e) => setRepeatType(e.target.value as TaskData['repeat_type'])}
          >
            <option value="none">NONE</option>
            <option value="daily">DAILY</option>
            <option value="weekly">WEEKLY</option>
          </select>
        </label>
      </div>
      <button type="submit">&#9658; TRACK TARGET</button>
    </form>
  );
}
