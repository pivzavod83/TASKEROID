# Taskeroid

Taskeroid is an Electron desktop task tracker where active tasks are rendered as asteroids orbiting and approaching a planet. Deadline drives distance to the planet, and importance drives asteroid size.

## Current Features

- Real-time 3D scene with planet, starfield, asteroid sprites, route lines, labels, and hover tooltips
- Frameless desktop window with custom title bar controls (minimize, maximize/restore, close)
- Slide-in mission panel (React UI) with two tabs: Mission Input and Current Tasks
- Click the planet to open the task panel
- Click an unlocked asteroid to open an in-scene quick edit popup
- Task focus mode from the list (highlights one asteroid, dims others)
- Task dependencies (`depends_on`) with lock state and lock tooltip for blocked tasks
- Repeating tasks (`repeat_type`: `none`, `daily`, `weekly`)
- Completion effects/animation in scene and IPC-synced updates
- Demo mode (`--demo`) to reset and seed sample tasks
- Single-instance app lock

## Tech Stack

- Electron 28
- TypeScript 5
- Three.js (scene rendering)
- React 18 (task panel UI)
- SQL.js (SQLite database persisted to local app data)
- esbuild (renderer and UI bundles)

## Project Structure

```text
taskeroid/
|- src/
|  |- main/        # Electron main process
|  |- preload/     # IPC bridge exposed to renderer
|  |- renderer/    # Three.js scene and render loop
|  |- ui/          # React mission panel
|  |- database/    # SQL.js init, schema, CRUD, migrations, demo seed
|  |- physics/     # Asteroid distance and size mapping
|  '- models/      # Task types
|- assets/         # app icon source (icon.png)
|- build/          # generated packaging resources (icon.ico)
|- index.html      # main window shell
|- ui.css          # UI/panel styles
'- package.json
```

## Setup and Run

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run

```bash
npm start
```

### Run demo mode

```bash
npm start -- --demo
```

This launches the app after rebuilding bundles.

## Scripts

- `npm run build` - TypeScript compile + renderer bundle + UI bundle
- `npm run build:wallpaper` - bundle scene renderer entry to `dist/wallpaper-renderer.js`
- `npm run build:ui` - bundle React UI to `dist/ui.js`
- `npm run watch` - run `tsc -w`
- `npm run icon:win` - generate Windows icon from `assets/icon.png` using `png2icons`
- `npm run dist:win` - build Windows NSIS installer in `release/`
- `npm start` / `npm run dev` - build then launch Electron

## Windows Installer

Build installer:

```bash
npm run dist:win
```

Output directory:

```text
release/
```

Installer includes desktop and Start Menu shortcut options.

## How to Use

1. Launch the app.
2. Click the planet to open the mission panel.
3. Add a task with title, priority (1-5), due date, optional dependency, and optional repeat mode.
4. Switch to Current Tasks to complete, edit, remove, or focus tasks.
5. Click an unlocked asteroid directly in the scene to quick-edit it.

## Task Data Model

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | unique task id |
| `title` | string | yes | task name |
| `importance` | 1-5 | yes | maps to asteroid size |
| `deadline` | number | yes | Unix timestamp (seconds) |
| `created_at` | number | yes | creation Unix timestamp (seconds) |
| `completed` | boolean | yes | completion state |
| `depends_on` | string \| null | no | id of prerequisite task |
| `repeat_type` | `none` \| `daily` \| `weekly` | yes | repeat behavior |
| `isUnlocked` | boolean | runtime | computed unlock state for dependency chains |

## Asteroid Mapping and Motion

- Importance maps to sprite scale in the range ~0.2 to ~0.9.
- Deadline drives inward motion using remaining time (not task age).
- Time window reference is 30 days (`MAX_TIME_WINDOW_SEC`).
- Distances are clamped between `MIN_RADIUS` and responsive `MAX_RADIUS`.
- Lower-priority tasks are biased slightly farther out at equal remaining time.

Core distance mapping:

```text
timeRemaining = max(0, deadline - now)
normalized = min(1, timeRemaining / 30_days)
lowPriorityBias = ((5 - importance) / 4) * 0.55
urgencyCurve = normalized ^ (1.45 + lowPriorityBias)
distance = MIN_RADIUS + urgencyCurve * (maxRadius - MIN_RADIUS)
```

Collision rule:

- When `now >= deadline`, the asteroid is treated as collided and removed from active scene/list state.

## Persistence

- Database file: `tasks.db`
- Location: Electron user data directory (`app.getPath('userData')`)
- Schema migrations run at startup (currently ensures `depends_on` and `repeat_type` columns exist)

## Notes

- Completed repeating tasks spawn the next occurrence automatically.
- By default, app startup seeds demo tasks only when the database is empty.
