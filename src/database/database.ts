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

function normalizeRepeatType(value: unknown): Task['repeat_type'] {
  return value === 'daily' || value === 'weekly' ? value : 'none';
}

function runMigrations(): void {
  if (!db) return;
  const colsRes = db.exec('PRAGMA table_info(tasks)');
  const existingCols = new Set<string>();
  const rowValues = colsRes?.[0]?.values as Array<Array<string | number>> | undefined;
  if (rowValues) {
    rowValues.forEach((row) => {
      if (typeof row[1] === 'string') {
        existingCols.add(row[1]);
      }
    });
  }

  if (!existingCols.has('depends_on')) {
    db.run('ALTER TABLE tasks ADD COLUMN depends_on TEXT');
  }
  if (!existingCols.has('repeat_type')) {
    db.run("ALTER TABLE tasks ADD COLUMN repeat_type TEXT NOT NULL DEFAULT 'none'");
  }
}

function readTasksFromQuery(whereClause = ''): Task[] {
  if (!db) return [];
  const stmt = db.prepare(`
    SELECT id, title, importance, deadline, created_at, completed, depends_on, repeat_type
    FROM tasks
    ${whereClause}
    ORDER BY deadline ASC
  `);
  const rows: Task[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject() as Record<string, string | number | null>;
    rows.push({
      id: String(r.id),
      title: String(r.title),
      importance: Number(r.importance),
      deadline: Number(r.deadline),
      created_at: Number(r.created_at),
      completed: Number(r.completed) === 1,
      depends_on: r.depends_on ? String(r.depends_on) : null,
      repeat_type: normalizeRepeatType(r.repeat_type),
    });
  }
  stmt.free();
  return rows;
}

function markUnlocked(tasks: Task[]): Task[] {
  const taskById = new Map<string, Task>();
  tasks.forEach((t) => taskById.set(t.id, t));

  return tasks.map((task) => {
    const dependsId = task.depends_on;
    if (!dependsId) {
      return { ...task, isUnlocked: true };
    }

    const dependency = taskById.get(dependsId) ?? getTaskById(dependsId);
    const unlocked = !dependency || dependency.completed;
    return { ...task, isUnlocked: unlocked };
  });
}

export function getActiveTasks(): Task[] {
  const tasks = readTasksFromQuery('WHERE completed = 0');
  return markUnlocked(tasks);
}

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
    runMigrations();
    saveDb();
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
  return getActiveTasks();
}

export function addTask(task: Task): void {
  if (!db) return;
  db.run(
    `INSERT INTO tasks (id, title, importance, deadline, created_at, completed, depends_on, repeat_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.title,
      task.importance,
      task.deadline,
      task.created_at,
      task.completed ? 1 : 0,
      task.depends_on,
      normalizeRepeatType(task.repeat_type),
    ]
  );
  saveDb();
}

export function updateTask(
  id: string,
  updates: Partial<Pick<Task, 'title' | 'importance' | 'deadline' | 'completed' | 'depends_on' | 'repeat_type'>>
): void {
  if (!db) return;
  const task = getTaskById(id);
  if (!task) return;
  const newTitle = updates.title ?? task.title;
  const newImportance = updates.importance ?? task.importance;
  const newDeadline = updates.deadline ?? task.deadline;
  const newCompleted = updates.completed ?? task.completed;
  const newDependsOn = updates.depends_on ?? task.depends_on;
  const newRepeatType = normalizeRepeatType(updates.repeat_type ?? task.repeat_type);
  db.run(
    `UPDATE tasks SET title = ?, importance = ?, deadline = ?, completed = ?, depends_on = ?, repeat_type = ? WHERE id = ?`,
    [newTitle, newImportance, newDeadline, newCompleted ? 1 : 0, newDependsOn, newRepeatType, id]
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
  const stmt = db.prepare('SELECT id, title, importance, deadline, created_at, completed, depends_on, repeat_type FROM tasks WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const r = stmt.getAsObject() as Record<string, string | number | null>;
  stmt.free();
  return {
    id: String(r.id),
    title: String(r.title),
    importance: Number(r.importance),
    deadline: Number(r.deadline),
    created_at: Number(r.created_at),
    completed: Number(r.completed) === 1,
    depends_on: r.depends_on ? String(r.depends_on) : null,
    repeat_type: normalizeRepeatType(r.repeat_type),
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
    { title: 'Review PR', importance: 5, deadline: now + 90, completed: false, depends_on: null, repeat_type: 'none' },
    { title: 'Ship release', importance: 5, deadline: now + 600, completed: false, depends_on: null, repeat_type: 'none' },
    { title: 'Team standup', importance: 4, deadline: now + 1800, completed: false, depends_on: null, repeat_type: 'daily' },
    { title: 'Fix bug', importance: 4, deadline: now + 7200, completed: false, depends_on: null, repeat_type: 'none' },
    { title: 'Write docs', importance: 3, deadline: now + 14400, completed: false, depends_on: null, repeat_type: 'none' },
    { title: 'Code review', importance: 3, deadline: now + 28800, completed: false, depends_on: null, repeat_type: 'none' },
    { title: 'Update dependencies', importance: 2, deadline: now + 86400, completed: false, depends_on: null, repeat_type: 'weekly' },
    { title: 'Reply to emails', importance: 2, deadline: now + 172800, completed: false, depends_on: null, repeat_type: 'daily' },
    { title: 'Organize notes', importance: 1, deadline: now + 259200, completed: false, depends_on: null, repeat_type: 'none' },
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
