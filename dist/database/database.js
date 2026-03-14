"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllTasks = getAllTasks;
exports.addTask = addTask;
exports.updateTask = updateTask;
exports.deleteTask = deleteTask;
exports.getTaskById = getTaskById;
exports.seedDemoIfEmpty = seedDemoIfEmpty;
exports.resetAndSeedDemo = resetAndSeedDemo;
exports.initDatabase = initDatabase;
exports.closeDatabase = closeDatabase;
/**
 * SQLite database layer for task storage (using sql.js - no native deps)
 */
const sql_js_1 = __importDefault(require("sql.js"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
const schema_1 = require("./schema");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db = null;
let dbReady = null;
async function ensureDb() {
    if (db)
        return;
    if (dbReady) {
        await dbReady;
        return;
    }
    dbReady = (async () => {
        const SQL = await (0, sql_js_1.default)({
            locateFile: (file) => path_1.default.join(__dirname, '../../node_modules/sql.js/dist', file),
        });
        const userDataPath = electron_1.app.getPath('userData');
        const dbPath = path_1.default.join(userDataPath, 'tasks.db');
        if (fs_1.default.existsSync(dbPath)) {
            const buf = fs_1.default.readFileSync(dbPath);
            db = new SQL.Database(buf);
        }
        else {
            db = new SQL.Database();
        }
        db.run(schema_1.CREATE_TASKS_TABLE);
    })();
    await dbReady;
}
function saveDb() {
    if (!db)
        return;
    const userDataPath = electron_1.app.getPath('userData');
    const dbPath = path_1.default.join(userDataPath, 'tasks.db');
    const data = db.export();
    fs_1.default.writeFileSync(dbPath, Buffer.from(data));
}
function getAllTasks() {
    if (!db)
        return [];
    const stmt = db.prepare(`
    SELECT id, title, importance, deadline, created_at, completed
    FROM tasks
    WHERE completed = 0
    ORDER BY deadline ASC
  `);
    const rows = [];
    while (stmt.step()) {
        const r = stmt.getAsObject();
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
function addTask(task) {
    if (!db)
        return;
    db.run(`INSERT INTO tasks (id, title, importance, deadline, created_at, completed)
     VALUES (?, ?, ?, ?, ?, ?)`, [task.id, task.title, task.importance, task.deadline, task.created_at, task.completed ? 1 : 0]);
    saveDb();
}
function updateTask(id, updates) {
    if (!db)
        return;
    const task = getTaskById(id);
    if (!task)
        return;
    const newTitle = updates.title ?? task.title;
    const newImportance = updates.importance ?? task.importance;
    const newDeadline = updates.deadline ?? task.deadline;
    const newCompleted = updates.completed ?? task.completed;
    db.run(`UPDATE tasks SET title = ?, importance = ?, deadline = ?, completed = ? WHERE id = ?`, [newTitle, newImportance, newDeadline, newCompleted ? 1 : 0, id]);
    saveDb();
}
function deleteTask(id) {
    if (!db)
        return;
    db.run('DELETE FROM tasks WHERE id = ?', [id]);
    saveDb();
}
function getTaskById(id) {
    if (!db)
        return null;
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
        stmt.free();
        return null;
    }
    const r = stmt.getAsObject();
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
function getTaskCount() {
    if (!db)
        return 0;
    const stmt = db.prepare('SELECT COUNT(*) as c FROM tasks');
    stmt.step();
    const c = stmt.getAsObject().c;
    stmt.free();
    return c;
}
function seedDemoTasks() {
    if (!db || getTaskCount() > 0)
        return;
    const now = Math.floor(Date.now() / 1000);
    const oneHourAgo = now - 3600;
    const demoTasks = [
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
        const task = {
            id: `demo_${i}_${now}`,
            ...t,
            created_at: oneHourAgo,
        };
        addTask(task);
    });
}
function seedDemoIfEmpty() {
    if (getTaskCount() === 0)
        seedDemoTasks();
}
function resetAndSeedDemo() {
    if (!db)
        return;
    db.run('DELETE FROM tasks');
    saveDb();
    seedDemoTasks();
}
async function initDatabase() {
    await ensureDb();
    seedDemoIfEmpty();
}
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
    dbReady = null;
}
//# sourceMappingURL=database.js.map