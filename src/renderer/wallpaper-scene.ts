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

export function createPlanet(scene: THREE.Scene): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1.2, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0x3a5a7a,
    emissive: 0x1a3a5a,
    emissiveIntensity: 0.3,
    metalness: 0.1,
    roughness: 0.8,
  });
  const planet = new THREE.Mesh(geometry, material);
  planet.position.set(0, 0, 0);
  scene.add(planet);

  const ringGeometry = new THREE.RingGeometry(1.4, 1.6, 64);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x4a7a9a,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  planet.add(ring);

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
