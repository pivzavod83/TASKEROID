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
  updateAsteroidLabel,
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
let completionEffects: Map<string, CompletionEffect> = new Map();
let planetShieldPulses: PlanetShieldPulse[] = [];
let latestTasks: Task[] = [];
let focusTaskId: string | null = null;

const HOVER_SCALE = 1.12;
const PLANET_SCALE_LERP = 10;

interface CompletionEffect {
  taskId: string;
  asteroid: AsteroidMesh;
  lockGroup: THREE.Group;
  lockRing: THREE.Mesh;
  lockCrosshair: THREE.LineSegments;
  beam: THREE.Line;
  explosion: THREE.Sprite;
  elapsed: number;
  duration: number;
  finished: boolean;
}

interface PlanetShieldPulse {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  elapsed: number;
  duration: number;
  startRadius: number;
  endRadius: number;
}

function createExplosionTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.45);
  grad.addColorStop(0, 'rgba(255, 245, 170, 1)');
  grad.addColorStop(0.22, 'rgba(255, 188, 88, 0.95)');
  grad.addColorStop(0.52, 'rgba(255, 96, 46, 0.68)');
  grad.addColorStop(0.85, 'rgba(255, 44, 30, 0.2)');
  grad.addColorStop(1, 'rgba(255, 44, 30, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, canvas.width * 0.45, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createPlanetShieldPulse(delaySec = 0): PlanetShieldPulse {
  const pulseMaterial = new THREE.MeshBasicMaterial({
    color: 0x6affee,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const pulseMesh = new THREE.Mesh(new THREE.RingGeometry(1, 1.06, 96), pulseMaterial);
  pulseMesh.position.copy(planet.position);
  pulseMesh.position.z = -0.04;
  pulseMesh.scale.setScalar(1.42);
  scene.add(pulseMesh);

  return {
    mesh: pulseMesh,
    material: pulseMaterial,
    elapsed: -Math.max(0, delaySec),
    duration: 1.15,
    startRadius: 1.42,
    endRadius: 7.2,
  };
}

function triggerPlanetShieldPulse(): void {
  planetShieldPulses.push(createPlanetShieldPulse(0));
  planetShieldPulses.push(createPlanetShieldPulse(0.08));
}

function disposePlanetShieldPulse(pulse: PlanetShieldPulse): void {
  scene.remove(pulse.mesh);
  pulse.mesh.geometry.dispose();
  pulse.material.dispose();
}

function updatePlanetShieldPulses(deltaSec: number): void {
  for (let i = planetShieldPulses.length - 1; i >= 0; i--) {
    const pulse = planetShieldPulses[i];
    pulse.elapsed += deltaSec;

    if (pulse.elapsed < 0) {
      continue;
    }

    const t = Math.min(1, pulse.elapsed / pulse.duration);
    const eased = 1 - Math.pow(1 - t, 2);
    const radius = THREE.MathUtils.lerp(pulse.startRadius, pulse.endRadius, eased);
    const alpha = Math.max(0, Math.pow(1 - t, 1.6));
    const shimmer = 0.85 + 0.15 * Math.sin(pulse.elapsed * 12);

    pulse.mesh.scale.setScalar(radius);
    pulse.mesh.rotation.z += deltaSec * 0.42;
    pulse.material.opacity = 0.26 * alpha * shimmer;

    if (t >= 1) {
      disposePlanetShieldPulse(pulse);
      planetShieldPulses.splice(i, 1);
    }
  }
}

function removeAsteroidImmediately(taskId: string, asteroid: AsteroidMesh): void {
  scene.remove(asteroid.mesh);
  scene.remove(asteroid.flame);
  scene.remove(asteroid.routeLine);
  scene.remove(asteroid.label);
  disposeAsteroidMesh(asteroid);
  asteroids.delete(taskId);
}

function disposeCompletionEffect(effect: CompletionEffect): void {
  scene.remove(effect.lockGroup);
  scene.remove(effect.beam);
  scene.remove(effect.explosion);

  effect.lockRing.geometry.dispose();
  (effect.lockRing.material as THREE.Material).dispose();
  effect.lockCrosshair.geometry.dispose();
  (effect.lockCrosshair.material as THREE.Material).dispose();
  effect.beam.geometry.dispose();
  (effect.beam.material as THREE.Material).dispose();

  const expMat = effect.explosion.material as THREE.SpriteMaterial;
  expMat.map?.dispose();
  expMat.dispose();
}

function createCompletionEffect(taskId: string, asteroid: AsteroidMesh): CompletionEffect {
  const pos = asteroid.mesh.position.clone();

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.44, 64),
    new THREE.MeshBasicMaterial({
      color: 0x00e5d4,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );

  const crossGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.68, 0, 0),
    new THREE.Vector3(-0.2, 0, 0),
    new THREE.Vector3(0.2, 0, 0),
    new THREE.Vector3(0.68, 0, 0),
    new THREE.Vector3(0, -0.68, 0),
    new THREE.Vector3(0, -0.2, 0),
    new THREE.Vector3(0, 0.2, 0),
    new THREE.Vector3(0, 0.68, 0),
  ]);
  const crosshair = new THREE.LineSegments(
    crossGeom,
    new THREE.LineBasicMaterial({
      color: 0x76fff0,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );

  const lockGroup = new THREE.Group();
  lockGroup.position.copy(pos);
  lockGroup.position.z = 0.08;
  lockGroup.add(ring);
  lockGroup.add(crosshair);
  scene.add(lockGroup);

  const beamGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -0.08),
    new THREE.Vector3(pos.x, pos.y, -0.08),
  ]);
  const beam = new THREE.Line(
    beamGeom,
    new THREE.LineBasicMaterial({
      color: 0xff6a3d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  scene.add(beam);

  const explosionTex = createExplosionTexture();
  const explosionMat = new THREE.SpriteMaterial({
    map: explosionTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    color: 0xffffff,
  });
  const explosion = new THREE.Sprite(explosionMat);
  explosion.position.copy(pos);
  explosion.position.z = 0.09;
  explosion.scale.set(0.4, 0.4, 1);
  scene.add(explosion);

  return {
    taskId,
    asteroid,
    lockGroup,
    lockRing: ring,
    lockCrosshair: crosshair,
    beam,
    explosion,
    elapsed: 0,
    duration: 1.25,
    finished: false,
  };
}

function updateCompletionEffects(deltaSec: number): void {
  completionEffects.forEach((effect, taskId) => {
    effect.elapsed += deltaSec;
    const t = Math.min(1, effect.elapsed / effect.duration);
    const lockT = Math.min(1, t / 0.46);
    const shotT = Math.min(1, Math.max(0, (t - 0.42) / 0.22));
    const boomT = Math.min(1, Math.max(0, (t - 0.6) / 0.4));

    const pulse = 0.92 + Math.sin(effect.elapsed * 17) * 0.06;
    effect.lockGroup.scale.setScalar((1.28 - lockT * 0.46) * pulse);
    effect.lockGroup.rotation.z += deltaSec * 1.6;

    const ringMat = effect.lockRing.material as THREE.MeshBasicMaterial;
    const crossMat = effect.lockCrosshair.material as THREE.LineBasicMaterial;
    ringMat.opacity = (1 - boomT) * (0.75 + (1 - lockT) * 0.2);
    crossMat.opacity = (1 - boomT) * (0.8 + (1 - lockT) * 0.15);

    const beamMat = effect.beam.material as THREE.LineBasicMaterial;
    beamMat.opacity = Math.sin(shotT * Math.PI) * 0.95 * (1 - boomT * 0.4);

    const asteroidMat = effect.asteroid.mesh.material as THREE.SpriteMaterial;
    if (boomT > 0) {
      asteroidMat.opacity = Math.max(0, 1 - boomT * 1.35);
      const kick = 1 + boomT * 0.14;
      effect.asteroid.mesh.scale.set(
        effect.asteroid.currentScale * kick,
        effect.asteroid.currentScale * kick,
        1
      );
    }

    const expMat = effect.explosion.material as THREE.SpriteMaterial;
    expMat.opacity = Math.max(0, Math.sin(boomT * Math.PI));
    const explosionScale = 0.35 + boomT * 2.6;
    effect.explosion.scale.set(explosionScale, explosionScale, 1);

    if (t >= 1 && !effect.finished) {
      effect.finished = true;
      disposeCompletionEffect(effect);
      removeAsteroidImmediately(taskId, effect.asteroid);
      completionEffects.delete(taskId);
    }
  });
}

export function playTaskCompleteAnimation(taskId: string): void {
  if (!scene) return;
  if (completionEffects.has(taskId)) return;

  const asteroid = asteroids.get(taskId);
  if (!asteroid) return;

  if (hoveredAsteroid?.taskId === taskId) {
    hoveredAsteroid = null;
    hideTooltip();
  }

  asteroid.flame.visible = false;
  asteroid.routeLine.visible = false;
  asteroid.label.visible = false;

  triggerPlanetShieldPulse();

  const effect = createCompletionEffect(taskId, asteroid);
  completionEffects.set(taskId, effect);
}

export function setFocusTask(taskId: string | null): void {
  focusTaskId = taskId;
}

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
    <div class="form-group">
      <label>Depends on</label>
      <select id="edit-depends-on">
        <option value="">None</option>
        ${latestTasks
          .filter((candidate) => !candidate.completed && candidate.id !== task.id)
          .map((candidate) => `<option value="${escapeHtml(candidate.id)}" ${task.depends_on === candidate.id ? 'selected' : ''}>${escapeHtml(candidate.title)}</option>`)
          .join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Repeat</label>
      <select id="edit-repeat-type">
        <option value="none" ${task.repeat_type === 'none' ? 'selected' : ''}>None</option>
        <option value="daily" ${task.repeat_type === 'daily' ? 'selected' : ''}>Daily</option>
        <option value="weekly" ${task.repeat_type === 'weekly' ? 'selected' : ''}>Weekly</option>
      </select>
    </div>
    <div class="actions">
      <button type="button" class="primary" id="edit-save">Save</button>
      <button type="button" id="edit-complete" ${task.isUnlocked === false ? 'disabled' : ''}>Complete</button>
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
    const dependsOn = (document.getElementById('edit-depends-on') as HTMLSelectElement)?.value || null;
    const repeatTypeRaw = (document.getElementById('edit-repeat-type') as HTMLSelectElement)?.value;
    const repeat_type = repeatTypeRaw === 'daily' || repeatTypeRaw === 'weekly' ? repeatTypeRaw : 'none';
    const deadline = Math.floor(new Date(`${date}T23:59:59`).getTime() / 1000);
    saveAndClose({ title, deadline, importance, depends_on: dependsOn, repeat_type });
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

    updatePlanetShieldPulses(deltaSec);
    updateCompletionEffects(deltaSec);

    asteroids.forEach((asteroid, taskId) => {
      if (completionEffects.has(taskId)) return;
      const task = (asteroid.mesh.userData as { task?: Task }).task;
      if (!task) return;
      if (hasCollided(task, now)) {
        removeAsteroidImmediately(taskId, asteroid);
        onCollision?.(taskId);
        return;
      }
      const isHovered = asteroid === hoveredAsteroid;
      updateAsteroidPosition(asteroid, task, now, maxRadius, deltaSec, isHovered);

      const hasFocus = focusTaskId !== null && asteroids.has(focusTaskId);
      const isFocused = hasFocus && taskId === focusTaskId;
      const isDimmed = hasFocus && !isFocused;

      const meshMat = asteroid.mesh.material as THREE.SpriteMaterial;
      const flameMat = asteroid.flame.material as THREE.SpriteMaterial;
      const routeMat = asteroid.routeLine.material as THREE.LineDashedMaterial;
      const labelMat = asteroid.label.material as THREE.SpriteMaterial;

      meshMat.opacity = isDimmed ? 0.2 : 1;
      flameMat.opacity = Math.min(1, flameMat.opacity * (isDimmed ? 0.12 : (isFocused ? 1.1 : 1)));
      routeMat.opacity = Math.min(1, routeMat.opacity * (isDimmed ? 0.08 : (isFocused ? 1.15 : 1)));
      labelMat.opacity = Math.min(1, labelMat.opacity * (isDimmed ? 0.28 : (isFocused ? 1.05 : 1)));

      if (isFocused) {
        asteroid.mesh.scale.multiplyScalar(1.08);
        asteroid.flame.scale.multiplyScalar(1.06);
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
  const size = getCanvasViewportSize(renderer.domElement);
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderer.setSize(size.width, size.height, false);
}

export function setTasks(tasks: Task[]): void {
  latestTasks = tasks;
  const now = Date.now() / 1000;
  const visibleTasks = tasks
    .filter((t) => t.isUnlocked !== false)
    .filter((t) => !hasCollided(t, now));
  const ids = new Set(visibleTasks.map((t) => t.id));

  asteroids.forEach((asteroid, taskId) => {
    if (!ids.has(taskId)) {
      if (completionEffects.has(taskId)) return;
      removeAsteroidImmediately(taskId, asteroid);
    }
  });

  const activeTasks = visibleTasks
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
      if (!prevTask || prevTask.title !== task.title) {
        updateAsteroidLabel(a, task.title);
      }
    } else {
      const asteroid = createAsteroidMesh(task, index, totalTasks);
      (asteroid.mesh.userData as { task?: Task }).task = task;
      setAsteroidTargetAngle(asteroid, targetAngle);
      scene.add(asteroid.mesh);
      scene.add(asteroid.flame);
      scene.add(asteroid.routeLine);
      scene.add(asteroid.label);
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
    removeAsteroidImmediately(a.taskId, a);
  });
  asteroids.clear();
  planetShieldPulses.forEach((pulse) => disposePlanetShieldPulse(pulse));
  planetShieldPulses = [];
  completionEffects.forEach((effect) => disposeCompletionEffect(effect));
  completionEffects.clear();
  if (starBackground) {
    scene.remove(starBackground.group);
    disposeStarBackground(starBackground);
  }
  renderer?.dispose();
}
