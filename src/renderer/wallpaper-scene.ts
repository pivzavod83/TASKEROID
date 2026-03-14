/**
 * Three.js wallpaper scene - space background, planet, asteroids
 */
import * as THREE from 'three';
import { Task } from '../models/task';
import {
  getAsteroidDistance,
  importanceToSize,
  MAX_RADIUS,
} from '../physics/asteroid-physics';

export interface AsteroidMesh {
  taskId: string;
  mesh: THREE.Mesh;
  baseAngle: number; // radians in XY plane
  angleOffset: number; // small random offset
}

export function createStarBackground(scene: THREE.Scene): void {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 800;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 50 + Math.random() * 50;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.computeBoundingSphere();
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.15,
    transparent: true,
    opacity: 0.9,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
}

/**
 * Generate equirectangular Earth-like texture: blue water + green continents
 */
function createEarthTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Blue oceans (base)
  ctx.fillStyle = '#0a4d7a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#00c896'; // bright green, high-tech glow
  // Simplified continent silhouettes (equirectangular projection)
  // Americas
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.25);
  ctx.lineTo(w * 0.22, h * 0.15);
  ctx.lineTo(w * 0.32, h * 0.22);
  ctx.lineTo(w * 0.34, h * 0.45);
  ctx.lineTo(w * 0.28, h * 0.72);
  ctx.lineTo(w * 0.22, h * 0.82);
  ctx.lineTo(w * 0.18, h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.68);
  ctx.lineTo(w * 0.35, h * 0.58);
  ctx.lineTo(w * 0.4, h * 0.78);
  ctx.closePath();
  ctx.fill();
  // Europe / Africa
  ctx.beginPath();
  ctx.moveTo(w * 0.48, h * 0.2);
  ctx.lineTo(w * 0.52, h * 0.18);
  ctx.lineTo(w * 0.55, h * 0.42);
  ctx.lineTo(w * 0.52, h * 0.72);
  ctx.lineTo(w * 0.47, h * 0.82);
  ctx.lineTo(w * 0.45, h * 0.48);
  ctx.closePath();
  ctx.fill();
  // Asia
  ctx.beginPath();
  ctx.moveTo(w * 0.54, h * 0.15);
  ctx.lineTo(w * 0.72, h * 0.12);
  ctx.lineTo(w * 0.88, h * 0.25);
  ctx.lineTo(w * 0.86, h * 0.48);
  ctx.lineTo(w * 0.7, h * 0.72);
  ctx.lineTo(w * 0.55, h * 0.52);
  ctx.closePath();
  ctx.fill();
  // Australia
  ctx.beginPath();
  ctx.moveTo(w * 0.76, h * 0.65);
  ctx.lineTo(w * 0.85, h * 0.62);
  ctx.lineTo(w * 0.88, h * 0.78);
  ctx.lineTo(w * 0.8, h * 0.84);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createPlanet(scene: THREE.Scene): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1.2, 64, 64);
  const texture = createEarthTexture();
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    emissive: 0x003344,
    emissiveIntensity: 0.5,
    metalness: 0.05,
    roughness: 0.5,
    transparent: true,
    opacity: 0.92,
  });
  const planet = new THREE.Mesh(geometry, material);
  planet.position.set(0, 0, 0);
  scene.add(planet);

  // Atmospheric glow
  const glowGeometry = new THREE.SphereGeometry(1.32, 32, 32);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.12,
    side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  planet.add(glow);

  // Latitude / longitude grid (glowing lines)
  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0x00e5cc,
    transparent: true,
    opacity: 0.35,
  });
  const r = 1.22;
  const toRad = Math.PI / 180;
  for (let lat = -75; lat <= 75; lat += 30) {
    const theta = (90 - lat) * toRad;
    const points: THREE.Vector3[] = [];
    for (let lon = 0; lon <= 360; lon += 4) {
      const phi = lon * toRad;
      points.push(
        new THREE.Vector3(
          r * Math.sin(theta) * Math.cos(phi),
          r * Math.cos(theta),
          r * Math.sin(theta) * Math.sin(phi)
        )
      );
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    planet.add(new THREE.Line(lineGeo, gridMaterial));
  }
  for (let lon = 0; lon < 360; lon += 18) {
    const phi = lon * toRad;
    const points: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 4) {
      const theta = (90 - lat) * toRad;
      points.push(
        new THREE.Vector3(
          r * Math.sin(theta) * Math.cos(phi),
          r * Math.cos(theta),
          r * Math.sin(theta) * Math.sin(phi)
        )
      );
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    planet.add(new THREE.Line(lineGeo, gridMaterial));
  }

  // Orbital rings (high-tech style)
  const orbitRadii = [1.5, 1.85, 2.2];
  orbitRadii.forEach((rad, i) => {
    const ringGeo = new THREE.RingGeometry(rad, rad + 0.025, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5cc,
      transparent: true,
      opacity: 0.2 - i * 0.04,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.y = i * 0.15;
    planet.add(ring);
  });

  return planet;
}

/**
 * Get responsive max radius to keep asteroids on-screen
 */
export function getResponsiveMaxRadius(camera: THREE.PerspectiveCamera): number {
  const vFOV = (camera.fov * Math.PI) / 180;
  const h = 2 * Math.tan(vFOV / 2) * Math.abs(camera.position.z);
  const w = h * camera.aspect;
  const minDim = Math.min(w, h);
  return Math.min(MAX_RADIUS, minDim * 0.4);
}

/**
 * Create asteroid with circular distribution and optional glow for high importance
 */
export function createAsteroidMesh(
  task: Task,
  taskIndex: number,
  totalTasks: number
): AsteroidMesh {
  const size = importanceToSize(task.importance);
  const geometry = new THREE.DodecahedronGeometry(size, 0);

  const hasGlow = task.importance >= 4;
  const material = new THREE.MeshStandardMaterial({
    color: 0x8b7355,
    roughness: 0.9,
    metalness: 0.1,
    emissive: hasGlow ? 0x4a3020 : 0x000000,
    emissiveIntensity: hasGlow ? 0.15 : 0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { taskId: task.id, task };

  // Circular distribution: angle = (index / total) * 2π + small random offset
  const baseAngle = (taskIndex / Math.max(1, totalTasks)) * Math.PI * 2;
  const angleOffset = (Math.random() - 0.5) * 0.4;

  return { taskId: task.id, mesh, baseAngle, angleOffset };
}

/**
 * Update asteroid position - time-based distance, smooth rotation
 */
export function updateAsteroidPosition(
  asteroid: AsteroidMesh,
  task: Task,
  currentTime: number,
  maxRadius: number,
  deltaSec: number
): void {
  const distance = getAsteroidDistance(task, currentTime, maxRadius);
  const angle = asteroid.baseAngle + asteroid.angleOffset;

  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  asteroid.mesh.position.set(x, y, 0);

  const rotSpeed = 0.3 * deltaSec;
  asteroid.mesh.rotation.x += rotSpeed * 0.6;
  asteroid.mesh.rotation.y += rotSpeed;

  // Slight depth scaling - farther = slightly smaller for depth perception
  const scale = 0.85 + 0.15 * (distance / maxRadius);
  asteroid.mesh.scale.setScalar(scale);
}
