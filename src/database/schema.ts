/**
 * SQLite schema and migrations
 */

export const CREATE_TASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    importance INTEGER NOT NULL CHECK(importance >= 1 AND importance <= 5),
    deadline INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
  )
`;

export const INIT_SQL = CREATE_TASKS_TABLE;
