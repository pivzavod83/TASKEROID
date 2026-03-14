/**
 * Game-loop style renderer - 60 FPS, time-based updates, raycasting tooltips
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
    <span style="color:#8b949e">Due: ${escapeHtml(deadlineStr)}</span><br>
    <span style="color:#58a6ff">Importance: ${task.importance}/5</span>
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

function onMouseMove(event: MouseEvent): void {
  mouseClientX = event.clientX;
  mouseClientY = event.clientY;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function updateTooltip(): void {
  raycaster.setFromCamera(mouse, camera);
  const meshes = Array.from(asteroids.values()).map((a) => a.mesh);
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const mesh = hit.object as THREE.Mesh;
    const data = mesh.userData as { task?: Task };
    if (data.task) {
      hoveredAsteroid = asteroids.get(data.task.id) || null;
      showTooltip(mouseClientX, mouseClientY, data.task);
      return;
    }
  }

  hoveredAsteroid = null;
  hideTooltip();
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
    });

    updateTooltip();
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
  if (canvas) canvas.removeEventListener('mousemove', onMouseMove);
  tooltipEl?.remove();
  tooltipEl = null;
  asteroids.forEach((a) => {
    scene.remove(a.mesh);
    a.mesh.geometry.dispose();
    (a.mesh.material as THREE.Material).dispose();
  });
  asteroids.clear();
  renderer?.dispose();
}
