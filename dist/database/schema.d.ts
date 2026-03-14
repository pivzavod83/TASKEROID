/**
 * SQLite schema and migrations
 */
export declare const CREATE_TASKS_TABLE = "\n  CREATE TABLE IF NOT EXISTS tasks (\n    id TEXT PRIMARY KEY,\n    title TEXT NOT NULL,\n    importance INTEGER NOT NULL CHECK(importance >= 1 AND importance <= 5),\n    deadline INTEGER NOT NULL,\n    created_at INTEGER NOT NULL,\n    completed INTEGER NOT NULL DEFAULT 0\n  )\n";
export declare const INIT_SQL = "\n  CREATE TABLE IF NOT EXISTS tasks (\n    id TEXT PRIMARY KEY,\n    title TEXT NOT NULL,\n    importance INTEGER NOT NULL CHECK(importance >= 1 AND importance <= 5),\n    deadline INTEGER NOT NULL,\n    created_at INTEGER NOT NULL,\n    completed INTEGER NOT NULL DEFAULT 0\n  )\n";
//# sourceMappingURL=schema.d.ts.map