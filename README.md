# Taskeroid

A desktop task manager with a visual twist: tasks appear as **asteroids** approaching a planet. Each asteroid's size shows importance and its distance shows time until the deadline.

## Overview

- **Main window**: Regular app window with the space scene—planet, asteroids, and starfield
- **Task panel**: Click "Manage Tasks" to open the side panel for adding, editing, and completing tasks

## Tech Stack

- **Electron** – desktop shell
- **Three.js** – WebGL rendering for the space scene
- **React** – Task Manager UI
- **TypeScript**
- **SQL.js** – task storage (SQLite in-browser)

## Project Structure

```
taskeroid/
├── src/
│   ├── main/           # Electron main process
│   ├── database/       # SQLite schema and CRUD
│   ├── models/         # Task type definitions
│   ├── physics/        # Asteroid position/size calculations
│   ├── renderer/       # Three.js scene and render loop
│   ├── preload/        # IPC bridge (app-preload)
│   └── ui/             # React task manager
├── assets/             # App icon (icon.png)
├── index.html          # Main app window
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

**Demo mode** (pre-seeded tasks):

```bash
npm start -- --demo
```

### Build scripts

- `npm run build` – compile TypeScript and bundle renderer/UI
- `npm start` – build and run the app
- `npm run build:wallpaper` – build only the scene bundle
- `npm run build:ui` – build only the UI bundle

## Usage

1. **Start the app** – A normal application window opens with the space scene.
2. **Manage tasks** – Click the "Manage Tasks" button to open the task panel.
3. **Add tasks** – Use the panel to add tasks with title, importance (1–5), and deadline.
4. **Tasks as asteroids** – Each task appears as an asteroid in the scene, moving toward the planet until the deadline.

## Task Data Model

| Field       | Type    | Required | Description                         |
|------------|---------|----------|-------------------------------------|
| id         | string  | yes      | Unique identifier                   |
| title      | string  | yes      | Task name                           |
| importance | 1–5     | yes      | Controls asteroid size              |
| deadline   | number  | yes      | Unix timestamp                      |
| created_at | number  | yes      | Creation timestamp                  |
| completed  | boolean | yes      | Whether the task is completed       |

## Asteroid Physics

- **Position**: Linear motion from max radius toward the planet
- **Formula**: `distance = max_radius * (1 - progress)` where  
  `progress = (now - created_at) / (deadline - created_at)`
- **Size**: Importance 1 → small, 5 → large
