/**
 * Game-loop style renderer - 60 FPS, raycasting, tooltips, click interactions
 */
import * as THREE from 'three';
import {
  createStarBackground,
  createPlanet,
  createAsteroidMesh,
  disposeAsteroidMesh,
  disposeStarBackground,
  updateAsteroidPosition,
  updateStarBackground,
  getResponsiveMaxRadius,
  updateAsteroidForImportance,
  setAsteroidTargetAngle,
  AsteroidMesh,
  StarBackground,
} from './wallpaper-scene';
import { Task } from '../models/task';
import { hasCollided } from '../physics/asteroid-physics';

declare const window: Window & {
  openTaskPanel?: () => void;
  taskeroidUI?: {
    updateTask: (id: string, u: unknown) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
  };
};

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let planet: THREE.Mesh;
let starBackground: StarBackground;
let asteroids: Map<string, AsteroidMesh> = new Map();
let animationId: number;
let lastTime = 0;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let mouseClientX = 0;
let mouseClientY = 0;
let tooltipEl: HTMLDivElement | null = null;
let hoveredAsteroid: AsteroidMesh | null = null;
let hoveredPlanet = false;
let asteroidEditPopup: HTMLDivElement | null = null;
let asteroidEditBackdrop: HTMLDivElement | null = null;
let planetScaleCurrent = 1;

const HOVER_SCALE = 1.12;
const PLANET_SCALE_LERP = 10;

function getCanvasViewportSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width || window.innerWidth));
  const height = Math.max(1, Math.floor(rect.height || window.innerHeight));
  return { width, height };
}

function createTooltip(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'asteroid-tooltip';
  el.style.cssText = `
    position: fixed;
    pointer-events: none;
     background: rgba(2, 8, 16, 0.96);
     color: #b8d8e4;
    padding: 8px 12px;
     font-family: 'Consolas', 'Lucida Console', 'Courier New', monospace;
    font-size: 13px;
     letter-spacing: 0.04em;
     text-transform: uppercase;
    max-width: 240px;
     border: 1px solid rgba(0, 229, 212, 0.35);
     border-left: 2px solid #00e5d4;
     box-shadow: 0 0 24px rgba(0, 229, 212, 0.1);
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.15s ease;
  `;
  document.body.appendChild(el);
  return el;
}

function showTooltip(x: number, y: number, task: Task): void {
  if (!tooltipEl) tooltipEl = createTooltip();
    const d = new Date(task.deadline * 1000);
    const deadlineFmt = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
    const secLeft = task.deadline - Date.now() / 1000;
    const etaStr = secLeft < 0
      ? 'OVERDUE'
      : `T−${String(Math.floor(secLeft / 86400)).padStart(2, '0')}D ${String(Math.floor((secLeft % 86400) / 3600)).padStart(2, '0')}H`;
  tooltipEl.innerHTML = `
      <strong style="color:#00e5d4">${escapeHtml(task.title)}</strong><br>
      <span style="color:#3a6070">DUE&nbsp;</span><span style="color:#b8d8e4">${escapeHtml(deadlineFmt)}</span><br>
      <span style="color:#3a6070">ETA&nbsp;</span><span style="color:${secLeft < 0 ? '#ff3247' : secLeft < 21600 ? '#ff3247' : secLeft < 86400 ? '#ffb300' : '#00d68f'}">${etaStr}</span>
  `;
  const offset = 14;
  let left = x + offset;
  let top = y + offset;
  if (left > window.innerWidth - 260) left = x - 250;
  if (top > window.innerHeight - 80) top = y - 70;
  if (left < 8) left = 8;
  if (top < 8) top = 8;
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.opacity = '1';
}

function hideTooltip(): void {
  if (tooltipEl) tooltipEl.style.opacity = '0';
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function closeAsteroidEdit(): void {
  if (asteroidEditPopup) asteroidEditPopup.classList.remove('open');
  if (asteroidEditBackdrop) asteroidEditBackdrop.classList.remove('open');
}

function openAsteroidEdit(task: Task): void {
  const popup = document.getElementById('asteroid-edit-popup');
  const backdrop = document.getElementById('asteroid-edit-backdrop');
  if (!popup || !backdrop) return;

  const defaultDate = new Date(task.deadline * 1000).toISOString().slice(0, 10);

  popup.innerHTML = `
    <h3>Edit Task</h3>
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="edit-title" value="${escapeHtml(task.title)}" />
    </div>
    <div class="form-group">
      <label>Deadline</label>
      <input type="date" id="edit-deadline" value="${defaultDate}" />
    </div>
    <div class="form-group">
      <label>Importance (1–5)</label>
      <input type="number" min="1" max="5" id="edit-importance" value="${task.importance}" />
    </div>
    <div class="actions">
      <button type="button" class="primary" id="edit-save">Save</button>
      <button type="button" id="edit-complete">Complete</button>
      <button type="button" class="delete" id="edit-delete">Delete</button>
    </div>
  `;

  const saveAndClose = (updates: Partial<Task>): void => {
    window.taskeroidUI?.updateTask?.(task.id, updates);
    closeAsteroidEdit();
  };

  const handleSave = (): void => {
    const title = (document.getElementById('edit-title') as HTMLInputElement)?.value?.trim() || task.title;
    const date = (document.getElementById('edit-deadline') as HTMLInputElement)?.value || defaultDate;
    const importance = Math.max(1, Math.min(5, Number((document.getElementById('edit-importance') as HTMLInputElement)?.value) || 3));
    const deadline = Math.floor(new Date(`${date}T23:59:59`).getTime() / 1000);
    saveAndClose({ title, deadline, importance });
  };

  const handleComplete = (): void => saveAndClose({ completed: true });
  const handleDelete = (): void => {
    window.taskeroidUI?.deleteTask?.(task.id);
    closeAsteroidEdit();
  };

  popup.querySelector('#edit-save')?.addEventListener('click', handleSave);
  popup.querySelector('#edit-complete')?.addEventListener('click', handleComplete);
  popup.querySelector('#edit-delete')?.addEventListener('click', handleDelete);
  backdrop.addEventListener('click', closeAsteroidEdit, { once: true });

  popup.classList.add('open');
  backdrop.classList.add('open');
  asteroidEditPopup = popup as HTMLDivElement;
  asteroidEditBackdrop = backdrop as HTMLDivElement;
}

function onMouseMove(event: MouseEvent): void {
  mouseClientX = event.clientX;
  mouseClientY = event.clientY;
  const rect = renderer.domElement.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  mouse.x = (localX / Math.max(1, rect.width)) * 2 - 1;
  mouse.y = -(localY / Math.max(1, rect.height)) * 2 + 1;
}

function updateHoverAndTooltip(): void {
  raycaster.setFromCamera(mouse, camera);
  // Planet: only the main sphere (no children) so hover area is smaller
  const planetHits = raycaster.intersectObject(planet, false);
  const asteroidMeshes = Array.from(asteroids.values()).map((a) => a.mesh);
  const asteroidHits = raycaster.intersectObjects(asteroidMeshes);
  const allHits = [...planetHits, ...asteroidHits].sort((a, b) => a.distance - b.distance);

  hoveredPlanet = false;
  hoveredAsteroid = null;

  if (allHits.length > 0) {
    const hit = allHits[0];
    const obj = hit.object;

    if (obj === planet) {
      hoveredPlanet = true;
    } else {
      const data = (obj as THREE.Mesh).userData as { task?: Task };
      if (data.task) {
        hoveredAsteroid = asteroids.get(data.task.id) || null;
        showTooltip(mouseClientX, mouseClientY, data.task);
      }
    }
  }

  if (!hoveredAsteroid) hideTooltip();

  // Update cursor
  const canvas = renderer.domElement;
  canvas.style.cursor = hoveredPlanet || hoveredAsteroid ? 'pointer' : 'default';
}

function onMouseClick(): void {
  raycaster.setFromCamera(mouse, camera);
  const planetHits = raycaster.intersectObject(planet, false);
  const asteroidMeshes = Array.from(asteroids.values()).map((a) => a.mesh);
  const asteroidHits = raycaster.intersectObjects(asteroidMeshes);
  const allHits = [...planetHits, ...asteroidHits].sort((a, b) => a.distance - b.distance);

  if (allHits.length === 0) return;

  const hit = allHits[0];
  const obj = hit.object;

  if (obj === planet) {
    window.openTaskPanel?.();
  } else {
    const data = (obj as THREE.Mesh).userData as { task?: Task };
    if (data.task) {
      openAsteroidEdit(data.task);
    }
  }
}

export function initWallpaper(canvas: HTMLCanvasElement, onCollision?: (taskId: string) => void): void {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a12);

  const initialSize = getCanvasViewportSize(canvas);
  camera = new THREE.PerspectiveCamera(60, initialSize.width / initialSize.height, 0.1, 100);
  camera.position.set(0, 0, 15);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(initialSize.width, initialSize.height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2(2, 2);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onMouseClick);

  const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 10, 10);
  scene.add(dirLight);

  starBackground = createStarBackground(scene);
  planet = createPlanet(scene);

  function animate(currentTime: number) {
    const deltaSec = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    const now = Date.now() / 1000;
    const maxRadius = getResponsiveMaxRadius(camera);
    updateStarBackground(starBackground, deltaSec, currentTime / 1000, camera);

    const targetScale = hoveredPlanet ? HOVER_SCALE : 1;
    planetScaleCurrent = THREE.MathUtils.lerp(planetScaleCurrent, targetScale, Math.min(1, deltaSec * PLANET_SCALE_LERP));
    planet.scale.setScalar(planetScaleCurrent);
    planet.rotation.y += 0.02 * deltaSec;

    asteroids.forEach((asteroid, taskId) => {
      const task = (asteroid.mesh.userData as { task?: Task }).task;
      if (!task) return;
      if (hasCollided(task, now)) {
        scene.remove(asteroid.mesh);
        scene.remove(asteroid.routeLine);
        disposeAsteroidMesh(asteroid);
        asteroids.delete(taskId);
        onCollision?.(taskId);
        return;
      }
      const isHovered = asteroid === hoveredAsteroid;
      updateAsteroidPosition(asteroid, task, now, maxRadius, deltaSec, isHovered);
    });

    updateHoverAndTooltip();
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }

  lastTime = performance.now();
  animationId = requestAnimationFrame(animate);

  window.addEventListener('resize', onResize);
}

function onResize(): void {
  if (!camera || !renderer) return;
  const size = getCanvasViewportSize(renderer.domElement);
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderer.setSize(size.width, size.height, false);
}

export function setTasks(tasks: Task[]): void {
  const ids = new Set(tasks.map((t) => t.id));

  asteroids.forEach((asteroid, taskId) => {
    if (!ids.has(taskId)) {
      scene.remove(asteroid.mesh);
      scene.remove(asteroid.routeLine);
      disposeAsteroidMesh(asteroid);
      asteroids.delete(taskId);
    }
  });

  const now = Date.now() / 1000;
  const activeTasks = tasks
    .filter((t) => !hasCollided(t, now))
    .sort((a, b) => (a.deadline - b.deadline) || a.id.localeCompare(b.id));
  const totalTasks = activeTasks.length;
  const angleStart = -Math.PI / 2;

  activeTasks.forEach((task, index) => {
    const targetAngle = angleStart + (index / Math.max(1, totalTasks)) * Math.PI * 2;
    if (asteroids.has(task.id)) {
      const a = asteroids.get(task.id)!;
      const prevTask = (a.mesh.userData as { task?: Task }).task;
      (a.mesh.userData as { task?: Task }).task = task;
      setAsteroidTargetAngle(a, targetAngle);
      if (prevTask && prevTask.importance !== task.importance) {
        updateAsteroidForImportance(a, task);
      }
    } else {
      const asteroid = createAsteroidMesh(task, index, totalTasks);
      (asteroid.mesh.userData as { task?: Task }).task = task;
      setAsteroidTargetAngle(asteroid, targetAngle);
      scene.add(asteroid.mesh);
      scene.add(asteroid.routeLine);
      asteroids.set(task.id, asteroid);
    }
  });
}

export function stopWallpaper(): void {
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', onResize);
  const canvas = renderer?.domElement;
  if (canvas) {
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('click', onMouseClick);
  }
  tooltipEl?.remove();
  tooltipEl = null;
  document.getElementById('asteroid-edit-popup')?.classList.remove('open');
  document.getElementById('asteroid-edit-backdrop')?.classList.remove('open');
  asteroids.forEach((a) => {
    scene.remove(a.mesh);
    scene.remove(a.routeLine);
    disposeAsteroidMesh(a);
  });
  asteroids.clear();
  if (starBackground) {
    scene.remove(starBackground.group);
    disposeStarBackground(starBackground);
  }
  renderer?.dispose();
}
