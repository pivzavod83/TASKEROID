/**
 * Game-loop style renderer - 60 FPS, raycasting, tooltips, click interactions
 */
import * as THREE from 'three';
import {
  createStarBackground,
  createPlanet,
  createAsteroidMesh,
  updateAsteroidPosition,
  getResponsiveMaxRadius,
  AsteroidMesh,
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

const HOVER_SCALE = 1.12;

function isPartOfPlanet(obj: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (o === planet) return true;
    o = o.parent;
  }
  return false;
}

function createTooltip(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'asteroid-tooltip';
  el.style.cssText = `
    position: fixed;
    pointer-events: none;
    background: rgba(15, 20, 25, 0.95);
    color: #e6edf3;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    max-width: 240px;
    border: 1px solid #30363d;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.15s ease;
  `;
  document.body.appendChild(el);
  return el;
}

function showTooltip(x: number, y: number, task: Task): void {
  if (!tooltipEl) tooltipEl = createTooltip();
  const deadlineStr = new Date(task.deadline * 1000).toLocaleString();
  tooltipEl.innerHTML = `
    <strong>${escapeHtml(task.title)}</strong><br>
    <span style="color:#8b949e">Due: ${escapeHtml(deadlineStr)}</span>
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
  const defaultTime = new Date(task.deadline * 1000).toISOString().slice(11, 16);

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
      <label>Time</label>
      <input type="time" id="edit-time" value="${defaultTime}" />
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
    const time = (document.getElementById('edit-time') as HTMLInputElement)?.value || defaultTime;
    const importance = Math.max(1, Math.min(5, Number((document.getElementById('edit-importance') as HTMLInputElement)?.value) || 3));
    const deadline = Math.floor(new Date(`${date}T${time}`).getTime() / 1000);
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
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function updateHoverAndTooltip(): void {
  raycaster.setFromCamera(mouse, camera);
  const planetMeshes: THREE.Object3D[] = [planet];
  const asteroidMeshes = Array.from(asteroids.values()).map((a) => a.mesh);
  const allObjects = [...planetMeshes, ...asteroidMeshes];
  const intersects = raycaster.intersectObjects(allObjects, true);

  hoveredPlanet = false;
  hoveredAsteroid = null;

  if (intersects.length > 0) {
    const hit = intersects[0];
    const obj = hit.object;

    if (isPartOfPlanet(obj)) {
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
  const planetMeshes: THREE.Object3D[] = [planet];
  const asteroidMeshes = Array.from(asteroids.values()).map((a) => a.mesh);
  const allObjects = [...planetMeshes, ...asteroidMeshes];
  const intersects = raycaster.intersectObjects(allObjects, true);

  if (intersects.length === 0) return;

  const hit = intersects[0];
  const obj = hit.object;

  if (isPartOfPlanet(obj)) {
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

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 15);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
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

  createStarBackground(scene);
  planet = createPlanet(scene);

  function animate(currentTime: number) {
    const deltaSec = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    const now = Date.now() / 1000;
    const maxRadius = getResponsiveMaxRadius(camera);

    planet.scale.setScalar(hoveredPlanet ? HOVER_SCALE : 1);
    planet.rotation.y += 0.02 * deltaSec;

    asteroids.forEach((asteroid, taskId) => {
      const task = (asteroid.mesh.userData as { task?: Task }).task;
      if (!task) return;
      if (hasCollided(task, now)) {
        scene.remove(asteroid.mesh);
        asteroid.mesh.geometry.dispose();
        (asteroid.mesh.material as THREE.Material).dispose();
        asteroids.delete(taskId);
        onCollision?.(taskId);
        return;
      }
      updateAsteroidPosition(asteroid, task, now, maxRadius, deltaSec);
      const isHovered = asteroid === hoveredAsteroid;
      if (isHovered) {
        const s = asteroid.mesh.scale.x;
        asteroid.mesh.scale.setScalar(s * HOVER_SCALE);
      }
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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function setTasks(tasks: Task[]): void {
  const ids = new Set(tasks.map((t) => t.id));

  asteroids.forEach((asteroid, taskId) => {
    if (!ids.has(taskId)) {
      scene.remove(asteroid.mesh);
      asteroid.mesh.geometry.dispose();
      (asteroid.mesh.material as THREE.Material).dispose();
      asteroids.delete(taskId);
    }
  });

  const now = Date.now() / 1000;
  const activeTasks = tasks.filter((t) => !hasCollided(t, now));
  const totalTasks = activeTasks.length;

  activeTasks.forEach((task, index) => {
    if (asteroids.has(task.id)) {
      const a = asteroids.get(task.id)!;
      (a.mesh.userData as { task?: Task }).task = task;
    } else {
      const asteroid = createAsteroidMesh(task, index, totalTasks);
      (asteroid.mesh.userData as { task?: Task }).task = task;
      scene.add(asteroid.mesh);
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
    a.mesh.geometry.dispose();
    (a.mesh.material as THREE.Material).dispose();
  });
  asteroids.clear();
  renderer?.dispose();
}
