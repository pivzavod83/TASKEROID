import React, { useState } from 'react';

interface TaskFormProps {
  onSubmit: (title: string, importance: number, deadline: number) => void;
}

export function TaskForm({ onSubmit }: TaskFormProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [importance, setImportance] = useState(3);
  const [deadlineDate, setDeadlineDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const d = deadlineDate || new Date().toISOString().slice(0, 10);
    const deadline = Math.floor(new Date(`${d}T23:59:59`).getTime() / 1000);
    onSubmit(title.trim(), importance, deadline);
    setTitle('');
    setImportance(3);
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
      <button type="submit">&#9658; TRACK TARGET</button>
    </form>
  );
}
