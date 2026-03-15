"use strict";
/**
 * SQLite schema and migrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INIT_SQL = exports.CREATE_TASKS_TABLE = void 0;
exports.CREATE_TASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    importance INTEGER NOT NULL CHECK(importance >= 1 AND importance <= 5),
    deadline INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    depends_on TEXT,
    repeat_type TEXT NOT NULL DEFAULT 'none' CHECK(repeat_type IN ('none', 'daily', 'weekly'))
  )
`;
exports.INIT_SQL = exports.CREATE_TASKS_TABLE;
//# sourceMappingURL=schema.js.map