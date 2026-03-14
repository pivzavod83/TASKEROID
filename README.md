# Taskeroid

A desktop application that combines an **animated wallpaper** with a **task management system**. Tasks appear as asteroids approaching a planet—each asteroid represents a to-do item, with its size showing importance and its distance showing time until the deadline.

## Overview

- **Wallpaper Renderer**: Runs automatically at startup, displays a space scene with a central planet and task-asteroids moving toward it
- **Task Manager UI**: Opens when you launch the app again or click the system tray icon

## Tech Stack

- **Electron** – desktop shell
- **Three.js** – WebGL rendering for the wallpaper
- **React** – Task Manager UI
- **TypeScript**
- **SQLite** (better-sqlite3) – task storage

## Project Structure

```
taskeroid/
├── src/
│   ├── main/           # Electron main process
│   ├── database/       # SQLite schema and CRUD
│   ├── models/         # Task type definitions
│   ├── physics/        # Asteroid position/size calculations
│   ├── renderer/       # Three.js wallpaper scene and loop
│   ├── preload/        # IPC bridge scripts
│   └── ui/             # React task manager
├── assets/             # Tray icon (add tray-icon.png for custom icon)
├── wallpaper.html      # Wallpaper window
├── ui.html             # Task Manager window
└── package.json
```

## Running the App

### Prerequisites

- Node.js 18+
- npm

### Install and run

```bash
cd taskeroid
npm install
npm start
```

**Demo mode**:

```bash
npm start -- --demo
```

### Build scripts

- `npm run build` – compile TypeScript and bundle renderer/UI
- `npm start` – build and run the app
- `npm run build:wallpaper` – build only the wallpaper bundle
- `npm run build:ui` – build only the UI bundle

## Usage

1. **Start the app** – The wallpaper window opens in fullscreen.
2. **Open Task Manager** – Click the system tray icon or run the app again (second instance).
3. **Add tasks** – Use the Task Manager to add tasks with title, importance (1–5), and deadline.
4. **Tasks as asteroids** – Each task appears as an asteroid in the wallpaper, moving toward the planet until the deadline.

## Task Data Model

| Field      | Type    | Required | Description                         |
|-----------|---------|----------|-------------------------------------|
| id        | string  | yes      | Unique identifier                   |
| title     | string  | yes      | Task name                           |
| importance| 1–5     | yes      | Controls asteroid size              |
| deadline  | number  | yes      | Unix timestamp                      |
| created_at| number  | yes      | Creation timestamp                  |
| completed | boolean | yes      | Whether the task is completed       |

## Asteroid Physics

- **Position**: Linear motion from max radius toward the planet
- **Formula**: `distance = max_radius * (1 - progress)` where  
  `progress = (now - created_at) / (deadline - created_at)`
- **Size**: Importance 1 → small, 5 → large

## Startup at Login

By default, the app does not run at login. To enable automatic wallpaper at startup, change `openAtLogin: false` to `true` in `src/main/index.ts`:

```typescript
app.setLoginItemSettings({ openAtLogin: true });
```

Then rebuild and run the app.

## Platform Notes

- **Windows**: System tray icon appears; second instance opens the Task Manager.
- **macOS**: Same behavior; tray in menu bar.
- **Linux**: Tray may be skipped on some environments.
