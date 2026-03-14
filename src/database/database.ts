/**
 * SQLite database layer for task storage (using sql.js - no native deps)
 */
import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { Task } from '../models/task';
import { CREATE_TASKS_TABLE } from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
let dbReady: Promise<void> | null = null;

async function ensureDb(): Promise<void> {
  if (db) return;
  if (dbReady) {
    await dbReady;
    return;
  }
  dbReady = (async () => {
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(__dirname, '../../node_modules/sql.js/dist', file),
    });
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'tasks.db');
    if (fs.existsSync(dbPath)) {
      const buf = fs.readFileSync(dbPath);
      db = new SQL.Database(buf);
    } else {
      db = new SQL.Database();
    }
    db!.run(CREATE_TASKS_TABLE);
  })();
  await dbReady;
}

function saveDb(): void {
  if (!db) return;
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'tasks.db');
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export function getAllTasks(): Task[] {
  if (!db) return [];
  const stmt = db.prepare(`
    SELECT id, title, importance, deadline, created_at, completed
    FROM tasks
    WHERE completed = 0
    ORDER BY deadline ASC
  `);
  const rows: Task[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject() as Record<string, string | number>;
    rows.push({
      id: String(r.id),
      title: String(r.title),
      importance: Number(r.importance),
      deadline: Number(r.deadline),
      created_at: Number(r.created_at),
      completed: Number(r.completed) === 1,
    });
  }
  stmt.free();
  return rows;
}

export function addTask(task: Task): void {
  if (!db) return;
  db.run(
    `INSERT INTO tasks (id, title, importance, deadline, created_at, completed)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [task.id, task.title, task.importance, task.deadline, task.created_at, task.completed ? 1 : 0]
  );
  saveDb();
}

export function updateTask(
  id: string,
  updates: Partial<Pick<Task, 'title' | 'importance' | 'deadline' | 'completed'>>
): void {
  if (!db) return;
  const task = getTaskById(id);
  if (!task) return;
  const newTitle = updates.title ?? task.title;
  const newImportance = updates.importance ?? task.importance;
  const newDeadline = updates.deadline ?? task.deadline;
  const newCompleted = updates.completed ?? task.completed;
  db.run(
    `UPDATE tasks SET title = ?, importance = ?, deadline = ?, completed = ? WHERE id = ?`,
    [newTitle, newImportance, newDeadline, newCompleted ? 1 : 0, id]
  );
  saveDb();
}

export function deleteTask(id: string): void {
  if (!db) return;
  db.run('DELETE FROM tasks WHERE id = ?', [id]);
  saveDb();
}

export function getTaskById(id: string): Task | null {
  if (!db) return null;
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const r = stmt.getAsObject() as Record<string, string | number>;
  stmt.free();
  return {
    id: String(r.id),
    title: String(r.title),
    importance: Number(r.importance),
    deadline: Number(r.deadline),
    created_at: Number(r.created_at),
    completed: Number(r.completed) === 1,
  };
}

function getTaskCount(): number {
  if (!db) return 0;
  const stmt = db.prepare('SELECT COUNT(*) as c FROM tasks');
  stmt.step();
  const c = (stmt.getAsObject() as { c: number }).c;
  stmt.free();
  return c;
}

function seedDemoTasks(): void {
  if (!db || getTaskCount() > 0) return;
  const now = Math.floor(Date.now() / 1000);
  const oneHourAgo = now - 3600;
  const demoTasks: Omit<Task, 'id' | 'created_at'>[] = [
    { title: 'Review PR', importance: 5, deadline: now + 90, completed: false },
    { title: 'Ship release', importance: 5, deadline: now + 600, completed: false },
    { title: 'Team standup', importance: 4, deadline: now + 1800, completed: false },
    { title: 'Fix bug', importance: 4, deadline: now + 7200, completed: false },
    { title: 'Write docs', importance: 3, deadline: now + 14400, completed: false },
    { title: 'Code review', importance: 3, deadline: now + 28800, completed: false },
    { title: 'Update dependencies', importance: 2, deadline: now + 86400, completed: false },
    { title: 'Reply to emails', importance: 2, deadline: now + 172800, completed: false },
    { title: 'Organize notes', importance: 1, deadline: now + 259200, completed: false },
  ];
  demoTasks.forEach((t, i) => {
    const task: Task = {
      id: `demo_${i}_${now}`,
      ...t,
      created_at: oneHourAgo,
    };
    addTask(task);
  });
}

export function seedDemoIfEmpty(): void {
  if (getTaskCount() === 0) seedDemoTasks();
}

export function resetAndSeedDemo(): void {
  if (!db) return;
  db.run('DELETE FROM tasks');
  saveDb();
  seedDemoTasks();
}

export async function initDatabase(): Promise<void> {
  await ensureDb();
  seedDemoIfEmpty();
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
  dbReady = null;
}
