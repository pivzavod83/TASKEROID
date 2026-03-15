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
  mesh: THREE.Sprite;
  flame: THREE.Sprite;
  routeLine: THREE.Line;
  label: THREE.Sprite;
  labelText: string;
  baseAngle: number; // radians in XY plane
  targetAngle: number;
  angleOffset: number; // small random offset
  baseScale: number;
  currentScale: number;
  currentDistance: number;
  flamePhase: number;
  flameFlickerSpeed: number;
  routePhase: number;
  routeSpeed: number;
}

interface StarLayer {
  points: THREE.Points;
  material: THREE.PointsMaterial;
  baseOpacity: number;
  twinklePhase: number;
  twinkleSpeed: number;
  rotationSpeedX: number;
  rotationSpeedY: number;
}

export interface StarBackground {
  group: THREE.Group;
  layers: StarLayer[];
}

function createStarLayer(
  starCount: number,
  radiusMin: number,
  radiusMax: number,
  size: number,
  color: number,
  opacity: number
): StarLayer {
  const starGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radiusMin + Math.random() * (radiusMax - radiusMin);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.computeBoundingSphere();
  const starMaterial = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  return {
    points: stars,
    material: starMaterial,
    baseOpacity: opacity,
    twinklePhase: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.18 + Math.random() * 0.12,
    rotationSpeedX: (Math.random() - 0.5) * 0.003,
    rotationSpeedY: 0.0015 + Math.random() * 0.003,
  };
}

export function createStarBackground(scene: THREE.Scene): StarBackground {
  const group = new THREE.Group();
  const layers = [
    createStarLayer(520, 48, 72, 0.13, 0xffffff, 0.75),
    createStarLayer(220, 72, 96, 0.17, 0xbfd9ff, 0.42),
    createStarLayer(140, 96, 122, 0.21, 0x7fb8ff, 0.24),
  ];

  layers.forEach((layer) => group.add(layer.points));
  scene.add(group);
  return { group, layers };
}

export function updateStarBackground(
  starBackground: StarBackground,
  deltaSec: number,
  elapsedSec: number,
  camera: THREE.PerspectiveCamera
): void {
  starBackground.group.position.copy(camera.position);

  starBackground.layers.forEach((layer, index) => {
    layer.points.rotation.x += layer.rotationSpeedX * deltaSec;
    layer.points.rotation.y += layer.rotationSpeedY * deltaSec * (1 + index * 0.18);
    layer.material.opacity = layer.baseOpacity + Math.sin(elapsedSec * layer.twinkleSpeed + layer.twinklePhase) * 0.04;
  });
}

export function disposeStarBackground(starBackground: StarBackground): void {
  starBackground.layers.forEach((layer) => {
    layer.points.geometry.dispose();
    layer.material.dispose();
  });
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
  planet.userData = { type: 'planet' };
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
  return Math.min(MAX_RADIUS, minDim * 0.46);
}

/**
 * Seeded random for deterministic results
 */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function tracePolygonPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radii: number[]
): void {
  radii.forEach((radius, index) => {
    const angle = (index / radii.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
}

function createAsteroidSpriteTexture(seed: number, intensity: number): THREE.CanvasTexture {
  const w = 384;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = rng(seed);
  const cx = w / 2;
  const cy = h / 2;
  const radius = w * 0.3;
  const outlinePoints = 11;
  const radii = Array.from({ length: outlinePoints }, (_, index) => {
    const bias = index === 0 || index === outlinePoints - 1 ? 1.06 : 1;
    return radius * (0.78 + rand() * 0.32) * bias;
  });

  ctx.clearRect(0, 0, w, h);

  const halo = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.55);
  halo.addColorStop(0, 'rgba(0, 0, 0, 0)');
  halo.addColorStop(0.45, `rgba(255, 90, 28, ${0.08 * intensity})`);
  halo.addColorStop(0.72, `rgba(255, 55, 12, ${0.045 * intensity})`);
  halo.addColorStop(1, 'rgba(0, 212, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  tracePolygonPath(ctx, cx, cy, radii);
  ctx.clip();

  const base = ctx.createRadialGradient(
    cx - radius * 0.34,
    cy - radius * 0.42,
    radius * 0.08,
    cx,
    cy,
    radius * 1.1
  );
  base.addColorStop(0, '#6d4b33');
  base.addColorStop(0.26, '#4a3328');
  base.addColorStop(0.58, '#231a18');
  base.addColorStop(1, '#09090b');
  ctx.fillStyle = base;
  ctx.beginPath();
  tracePolygonPath(ctx, cx, cy, radii);
  ctx.fill();

  const lavaUnderpaint = ctx.createRadialGradient(
    cx - radius * 0.22,
    cy + radius * 0.18,
    radius * 0.06,
    cx,
    cy,
    radius * 1.1
  );
  lavaUnderpaint.addColorStop(0, `rgba(255, 140, 42, ${0.7 * intensity})`);
  lavaUnderpaint.addColorStop(0.35, `rgba(255, 72, 22, ${0.5 * intensity})`);
  lavaUnderpaint.addColorStop(0.7, `rgba(165, 28, 12, ${0.22 * intensity})`);
  lavaUnderpaint.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = lavaUnderpaint;
  ctx.beginPath();
  ctx.arc(cx - radius * 0.08, cy + radius * 0.06, radius * 1.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 7; i++) {
    const startAngle = -Math.PI * 0.9 + rand() * Math.PI * 1.8;
    const startDistance = radius * (0.08 + rand() * 0.16);
    let currentX = cx + Math.cos(startAngle) * startDistance;
    let currentY = cy + Math.sin(startAngle) * startDistance;
    const segments = 4 + Math.floor(rand() * 3);
    const points: Array<{ x: number; y: number }> = [{ x: currentX, y: currentY }];

    for (let segment = 0; segment < segments; segment++) {
      const stepAngle = startAngle + (rand() * 2 - 1) * 0.55 + segment * 0.14;
      const stepLength = radius * (0.18 + rand() * 0.16);
      currentX += Math.cos(stepAngle) * stepLength;
      currentY += Math.sin(stepAngle) * stepLength;
      points.push({ x: currentX, y: currentY });
    }

    ctx.strokeStyle = `rgba(255, 86, 24, ${0.08 * intensity})`;
    ctx.lineWidth = radius * 0.24;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 104, 28, ${0.4 * intensity})`;
    ctx.lineWidth = radius * 0.11;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 178, 72, ${0.52 * intensity})`;
    ctx.lineWidth = radius * 0.038;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
  }

  for (let i = 0; i < 9; i++) {
    const facetAngle = rand() * Math.PI * 2;
    const facetDistance = rand() * radius * 0.34;
    const facetX = cx + Math.cos(facetAngle) * facetDistance;
    const facetY = cy + Math.sin(facetAngle) * facetDistance;
    const facetWidth = radius * (0.48 + rand() * 0.28);
    const facetHeight = radius * (0.12 + rand() * 0.1);
    const facetGradient = ctx.createLinearGradient(
      facetX - facetWidth,
      facetY - facetHeight,
      facetX + facetWidth,
      facetY + facetHeight
    );
    facetGradient.addColorStop(0, 'rgba(178, 126, 82, 0.28)');
    facetGradient.addColorStop(0.45, 'rgba(40, 26, 21, 0.03)');
    facetGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = facetGradient;
    ctx.beginPath();
    ctx.ellipse(facetX, facetY, facetWidth, facetHeight, facetAngle, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 200; i++) {
    const angle = rand() * Math.PI * 2;
    const distance = Math.sqrt(rand()) * radius * 1.04;
    const x = cx + Math.cos(angle) * distance;
    const y = cy + Math.sin(angle) * distance;
    const alpha = 0.02 + rand() * 0.05;
    const shade = 58 + Math.floor(rand() * 28);
    ctx.fillStyle = `rgba(${shade}, ${Math.max(0, shade - 10)}, ${Math.max(0, shade - 18)}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.7 + rand() * 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = radius * 0.015;
  for (let i = 0; i < 10; i++) {
    const startAngle = rand() * Math.PI * 2;
    const sweep = (0.14 + rand() * 0.16) * (rand() > 0.5 ? 1 : -1);
    const crackRadius = radius * (0.25 + rand() * 0.62);
    ctx.strokeStyle = rand() > 0.75 ? 'rgba(255, 136, 42, 0.16)' : 'rgba(255, 214, 170, 0.1)';
    ctx.beginPath();
    ctx.arc(cx, cy, crackRadius, startAngle, startAngle + sweep);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 214, 160, 0.14)';
  ctx.lineWidth = radius * 0.008;
  for (let i = 0; i < 6; i++) {
    const ax = cx + (rand() * 2 - 1) * radius * 0.7;
    const ay = cy + (rand() * 2 - 1) * radius * 0.7;
    const bx = ax + (rand() * 2 - 1) * radius * 0.35;
    const by = ay + (rand() * 2 - 1) * radius * 0.35;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  const shadow = ctx.createRadialGradient(
    cx + radius * 0.3,
    cy + radius * 0.28,
    radius * 0.18,
    cx,
    cy,
    radius * 1.05
  );
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0.02)');
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0.56)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  tracePolygonPath(ctx, cx, cy, radii);
  ctx.fill();

  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const edgeGlow = ctx.createLinearGradient(cx - radius, cy + radius * 0.6, cx + radius * 0.3, cy - radius * 0.4);
  edgeGlow.addColorStop(0, `rgba(255, 76, 20, ${0.38 * intensity})`);
  edgeGlow.addColorStop(0.45, `rgba(255, 118, 30, ${0.16 * intensity})`);
  edgeGlow.addColorStop(1, 'rgba(255, 118, 30, 0)');
  ctx.strokeStyle = edgeGlow;
  ctx.lineWidth = radius * 0.08;
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.82, cy + radius * 0.86);
  ctx.lineTo(cx - radius * 0.5, cy + radius * 0.34);
  ctx.lineTo(cx - radius * 0.16, cy + radius * 0.14);
  ctx.stroke();
  ctx.restore();

  const rim = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  rim.addColorStop(0, 'rgba(183, 126, 79, 0.34)');
  rim.addColorStop(0.48, 'rgba(37, 27, 21, 0.08)');
  rim.addColorStop(1, `rgba(255, 116, 34, ${0.18 * intensity})`);
  ctx.strokeStyle = rim;
  ctx.lineWidth = radius * 0.03;
  ctx.beginPath();
  tracePolygonPath(ctx, cx, cy, radii.map((value) => value * 0.98));
  ctx.stroke();

  const glint = ctx.createLinearGradient(
    cx - radius * 0.78,
    cy - radius * 0.62,
    cx + radius * 0.18,
    cy + radius * 0.24
  );
  glint.addColorStop(0, 'rgba(255, 220, 176, 0)');
  glint.addColorStop(0.35, 'rgba(255, 220, 176, 0.08)');
  glint.addColorStop(0.55, 'rgba(255, 220, 176, 0.18)');
  glint.addColorStop(1, 'rgba(255, 220, 176, 0)');
  ctx.strokeStyle = glint;
  ctx.lineWidth = radius * 0.02;
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.62, cy - radius * 0.52);
  ctx.lineTo(cx + radius * 0.22, cy - radius * 0.12);
  ctx.stroke();

  const specular = ctx.createRadialGradient(
    cx - radius * 0.32,
    cy - radius * 0.4,
    0,
    cx - radius * 0.32,
    cy - radius * 0.4,
    radius * 0.42
  );
  specular.addColorStop(0, 'rgba(255, 214, 172, 0.14)');
  specular.addColorStop(1, 'rgba(255, 214, 172, 0)');
  ctx.fillStyle = specular;
  ctx.beginPath();
  ctx.arc(cx - radius * 0.15, cy - radius * 0.15, radius * 0.85, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createRouteLine(): THREE.Line {
  const segmentCount = 24;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segmentCount; i++) {
    points.push(new THREE.Vector3(0, 0, -0.02));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({
    color: 0x00e5d4,
    transparent: true,
    opacity: 0.55,
    dashSize: 0.16,
    gapSize: 0.11,
  });

  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

function createFlameTexture(seed: number, intensity: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  const rand = rng(seed + 9100);
  const headX = 72;
  const headY = 80;

  // Soft comet halo.
  const halo = ctx.createRadialGradient(headX, headY, 0, headX, headY, 86);
  halo.addColorStop(0, `rgba(255, 242, 184, ${0.68 * intensity})`);
  halo.addColorStop(0.35, `rgba(255, 172, 62, ${0.33 * intensity})`);
  halo.addColorStop(0.8, `rgba(255, 86, 22, ${0.08 * intensity})`);
  halo.addColorStop(1, 'rgba(255, 86, 22, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(headX, headY, 86, 0, Math.PI * 2);
  ctx.fill();

  // Main outer plume.
  const outer = new Path2D();
  outer.moveTo(28, 80);
  outer.bezierCurveTo(26, 60, 44, 42, 74, 36);
  outer.bezierCurveTo(120, 28, 184, 38, 244, 50);
  outer.bezierCurveTo(280, 56, 302, 70, 300, 80);
  outer.bezierCurveTo(298, 92, 278, 104, 238, 112);
  outer.bezierCurveTo(178, 124, 118, 134, 72, 126);
  outer.bezierCurveTo(44, 122, 26, 102, 28, 80);
  outer.closePath();

  const outerGrad = ctx.createLinearGradient(24, 80, 304, 80);
  outerGrad.addColorStop(0, '#fff8d0');
  outerGrad.addColorStop(0.16, '#ffd25f');
  outerGrad.addColorStop(0.45, '#ff8f27');
  outerGrad.addColorStop(0.82, '#ff4e11');
  outerGrad.addColorStop(1, 'rgba(150, 18, 0, 0.35)');
  ctx.fillStyle = outerGrad;
  ctx.fill(outer);

  // Bright inner core taper.
  const core = new Path2D();
  core.moveTo(40, 80);
  core.bezierCurveTo(46, 64, 66, 56, 98, 56);
  core.bezierCurveTo(144, 56, 194, 64, 234, 72);
  core.bezierCurveTo(250, 76, 260, 78, 260, 80);
  core.bezierCurveTo(260, 82, 250, 84, 234, 88);
  core.bezierCurveTo(194, 96, 144, 104, 98, 104);
  core.bezierCurveTo(66, 104, 46, 96, 40, 80);
  core.closePath();

  const coreGrad = ctx.createLinearGradient(40, 80, 264, 80);
  coreGrad.addColorStop(0, '#ffffec');
  coreGrad.addColorStop(0.24, '#ffe77d');
  coreGrad.addColorStop(0.62, '#ffb238');
  coreGrad.addColorStop(1, 'rgba(255, 111, 25, 0.15)');
  ctx.fillStyle = coreGrad;
  ctx.fill(core);

  // Turbulent streaks and tongues in the tail.
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 16; i++) {
    const y = 52 + rand() * 56;
    const x0 = 92 + rand() * 30;
    const x1 = 210 + rand() * 90;
    const wobble = (rand() - 0.5) * 18;
    ctx.strokeStyle = `rgba(255, ${170 + Math.floor(rand() * 50)}, ${34 + Math.floor(rand() * 24)}, ${0.12 + rand() * 0.18})`;
    ctx.lineWidth = 1.2 + rand() * 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) * 0.5, y + wobble, x1, y + wobble * 0.5);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  // Small embers around the wake.
  for (let i = 0; i < 70; i++) {
    const t = rand();
    const x = 98 + t * 210 + rand() * 18;
    const y = 80 + (rand() - 0.5) * (24 + t * 36);
    const r = 0.5 + rand() * 1.6;
    ctx.fillStyle = `rgba(255, ${110 + Math.floor(rand() * 80)}, ${20 + Math.floor(rand() * 24)}, ${0.06 + (1 - t) * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createLabelTexture(text: string): THREE.CanvasTexture {
  const labelText = text.trim().slice(0, 42) || 'UNTITLED TASK';
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '700 54px Consolas, "Lucida Console", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const x = canvas.width / 2;
  const y = canvas.height / 2;
  ctx.strokeStyle = 'rgba(5, 12, 20, 0.95)';
  ctx.lineWidth = 14;
  ctx.strokeText(labelText, x, y);
  ctx.fillStyle = 'rgba(190, 244, 255, 0.95)';
  ctx.fillText(labelText, x, y);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function updateAsteroidLabel(asteroid: AsteroidMesh, title: string): void {
  const nextText = title.trim().slice(0, 42) || 'UNTITLED TASK';
  if (asteroid.labelText === nextText) return;

  const labelMaterial = asteroid.label.material as THREE.SpriteMaterial;
  labelMaterial.map?.dispose();
  labelMaterial.map = createLabelTexture(nextText);
  labelMaterial.needsUpdate = true;
  asteroid.labelText = nextText;
}

function lerpAngle(current: number, target: number, alpha: number): number {
  let diff = (target - current + Math.PI) % (Math.PI * 2);
  if (diff < 0) diff += Math.PI * 2;
  diff -= Math.PI;
  return current + diff * alpha;
}

export function setAsteroidTargetAngle(asteroid: AsteroidMesh, targetAngle: number): void {
  asteroid.targetAngle = targetAngle;
}

/**
 * Create asteroid - detailed rocky form with molten glowing pockets
 */
export function createAsteroidMesh(
  task: Task,
  taskIndex: number,
  totalTasks: number
): AsteroidMesh {
  const size = importanceToSize(task.importance);
  const seed = taskIndex * 1000 + task.deadline;
  const hasGlow = task.importance >= 4;
  const glowIntensity = hasGlow ? 1 : 0.82;

  const material = new THREE.SpriteMaterial({
    map: createAsteroidSpriteTexture(seed, glowIntensity),
    transparent: true,
    depthWrite: false,
    color: 0xffffff,
  });
  const flameMaterial = new THREE.SpriteMaterial({
    map: createFlameTexture(seed, 0.95),
    transparent: true,
    depthWrite: false,
    color: 0xffffff,
    opacity: 0.62,
  });
  const labelText = task.title.trim().slice(0, 42) || 'UNTITLED TASK';
  const labelMaterial = new THREE.SpriteMaterial({
    map: createLabelTexture(labelText),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    color: 0xffffff,
    opacity: 0.92,
  });

  const mesh = new THREE.Sprite(material);
  const flame = new THREE.Sprite(flameMaterial);
  const label = new THREE.Sprite(labelMaterial);
  const routeLine = createRouteLine();
  mesh.userData = { taskId: task.id, task };
  const baseScale = size * 2.35;
  mesh.scale.setScalar(baseScale);
  flame.center.set(0.2, 0.5);
  label.center.set(0.5, 0);
  label.scale.set(baseScale * 2.7, baseScale * 0.72, 1);

  const baseAngle = (taskIndex / Math.max(1, totalTasks)) * Math.PI * 2;
  const angleOffset = (Math.random() - 0.5) * 0.4;
  const flamePhase = Math.random() * Math.PI * 2;
  const flameFlickerSpeed = 0.7 + Math.random() * 0.35;
  const routePhase = Math.random() * Math.PI * 2;
  const routeSpeed = 0.55 + Math.random() * 0.24;
  const nowSec = Date.now() / 1000;
  const initialDistance = getAsteroidDistance(task, nowSec, MAX_RADIUS);

  return {
    taskId: task.id,
    mesh,
    flame,
    routeLine,
    label,
    labelText,
    baseAngle,
    targetAngle: baseAngle,
    angleOffset,
    baseScale,
    currentScale: baseScale,
    currentDistance: initialDistance,
    flamePhase,
    flameFlickerSpeed,
    routePhase,
    routeSpeed,
  };
}

/**
 * Update asteroid mesh geometry and material when importance changes
 */
export function updateAsteroidForImportance(asteroid: AsteroidMesh, task: Task): void {
  const seed = task.deadline + 123;
  const mat = asteroid.mesh.material as THREE.SpriteMaterial;

  if (mat.map) {
    mat.map.dispose();
  }

  const hasGlow = task.importance >= 4;
  const glowIntensity = hasGlow ? 1 : 0.82;
  asteroid.baseScale = importanceToSize(task.importance) * 2.35;
  mat.map = createAsteroidSpriteTexture(seed, glowIntensity);
  mat.needsUpdate = true;
}

export function disposeAsteroidMesh(asteroid: AsteroidMesh): void {
  const material = asteroid.mesh.material as THREE.SpriteMaterial;
  const flameMaterial = asteroid.flame.material as THREE.SpriteMaterial;
  const labelMaterial = asteroid.label.material as THREE.SpriteMaterial;
  const routeMaterial = asteroid.routeLine.material as THREE.LineDashedMaterial;
  material.map?.dispose();
  material.dispose();
  flameMaterial.map?.dispose();
  flameMaterial.dispose();
  labelMaterial.map?.dispose();
  labelMaterial.dispose();
  asteroid.routeLine.geometry.dispose();
  routeMaterial.dispose();
}

/**
 * Update asteroid position - time-based distance, smooth rotation
 */
export function updateAsteroidPosition(
  asteroid: AsteroidMesh,
  task: Task,
  currentTime: number,
  maxRadius: number,
  deltaSec: number,
  isHovered: boolean
): void {
  const targetDistance = getAsteroidDistance(task, currentTime, maxRadius);
  if (!Number.isFinite(asteroid.currentDistance) || asteroid.currentDistance <= 0) {
    asteroid.currentDistance = targetDistance;
  }
  asteroid.currentDistance = THREE.MathUtils.lerp(
    asteroid.currentDistance,
    targetDistance,
    Math.min(1, deltaSec * 4.2)
  );

  asteroid.baseAngle = lerpAngle(
    asteroid.baseAngle,
    asteroid.targetAngle,
    Math.min(1, deltaSec * 2.6)
  );

  const distance = asteroid.currentDistance;
  const angle = asteroid.baseAngle + asteroid.angleOffset;

  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  asteroid.mesh.position.set(x, y, 0);

  // Slight depth scaling keeps distant sprites lighter in visual weight.
  const baseScale = asteroid.baseScale * (0.86 + 0.16 * (distance / maxRadius));
  const targetScale = baseScale * (isHovered ? 1.12 : 1);
  asteroid.currentScale = THREE.MathUtils.lerp(
    asteroid.currentScale,
    targetScale,
    Math.min(1, deltaSec * 10)
  );
  asteroid.mesh.scale.set(asteroid.currentScale, asteroid.currentScale, 1);

  const distanceToPlanet = Math.sqrt(x * x + y * y);
  const dirToPlanetX = distanceToPlanet > 0.0001 ? -x / distanceToPlanet : 0;
  const dirToPlanetY = distanceToPlanet > 0.0001 ? -y / distanceToPlanet : 0;
  const awayX = -dirToPlanetX;
  const awayY = -dirToPlanetY;
  const perpX = -awayY;
  const perpY = awayX;

  const labelScaleBase = THREE.MathUtils.clamp(asteroid.currentScale, 0.42, 1.5);
  const labelOffset = asteroid.currentScale * 0.34;
  asteroid.label.position.set(x + awayX * labelOffset, y + awayY * labelOffset, 0.03);
  asteroid.label.scale.set(labelScaleBase * 2.7, labelScaleBase * 0.72, 1);
  const labelMaterial = asteroid.label.material as THREE.SpriteMaterial;
  labelMaterial.opacity = isHovered ? 1 : 0.9;

  const flamePulse = 1 + Math.sin(currentTime * asteroid.flameFlickerSpeed + asteroid.flamePhase) * 0.08;
  const flameDrift = Math.sin(currentTime * (asteroid.flameFlickerSpeed * 0.7) + asteroid.flamePhase) * 0.03;
  const wiggle = Math.sin(currentTime * (asteroid.flameFlickerSpeed * 1.9) + asteroid.flamePhase * 1.4) * asteroid.currentScale * 0.12;
  const wiggleSecondary = Math.sin(currentTime * (asteroid.flameFlickerSpeed * 1.2) + asteroid.flamePhase * 0.6) * asteroid.currentScale * 0.05;
  const headOffset = asteroid.currentScale * 0.18;
  asteroid.flame.position.set(
    x + awayX * (headOffset + flameDrift) + perpX * (wiggle + wiggleSecondary),
    y + awayY * (headOffset + flameDrift) + perpY * (wiggle + wiggleSecondary),
    -0.09
  );
  const stretch = 1 + Math.sin(currentTime * (asteroid.flameFlickerSpeed * 0.95) + asteroid.flamePhase) * 0.16;
  const squash = 1 + Math.cos(currentTime * (asteroid.flameFlickerSpeed * 1.35) + asteroid.flamePhase) * 0.09;
  asteroid.flame.scale.set(
    asteroid.currentScale * 1.55 * flamePulse * stretch,
    asteroid.currentScale * 0.68 * flamePulse * squash,
    1
  );
  const flameMaterial = asteroid.flame.material as THREE.SpriteMaterial;
  // Texture points to +X, rotate so the tail stays opposite of motion toward the planet.
  const flutter = Math.sin(currentTime * (asteroid.flameFlickerSpeed * 1.45) + asteroid.flamePhase) * 0.18;
  flameMaterial.rotation = Math.atan2(awayY, awayX) + flutter;
  flameMaterial.opacity = 0.48 + Math.sin(currentTime * (asteroid.flameFlickerSpeed * 0.9) + asteroid.flamePhase) * 0.08;

  // Animated dashed route from asteroid to planet center.
  const routeGeo = asteroid.routeLine.geometry as THREE.BufferGeometry;
  const routeMat = asteroid.routeLine.material as THREE.LineDashedMaterial;
  const routePositions = routeGeo.attributes.position as THREE.BufferAttribute;
  const pointCount = routePositions.count;
  const dirX = dirToPlanetX;
  const dirY = dirToPlanetY;
  const normalX = -dirY;
  const normalY = dirX;
  const baseWaveAmp = Math.min(0.22, distanceToPlanet * 0.05);
  const routeZ = -0.35;

  for (let i = 0; i < pointCount; i++) {
    const t = pointCount <= 1 ? 0 : i / (pointCount - 1);
    const xBase = x * (1 - t);
    const yBase = y * (1 - t);
    const envelope = Math.sin(Math.PI * t) * (1 - t * 0.3);
    const wave = Math.sin(currentTime * (1.1 * asteroid.routeSpeed) + asteroid.routePhase + t * 7.2);
    const offset = wave * baseWaveAmp * envelope;
    routePositions.setXYZ(i, xBase + normalX * offset, yBase + normalY * offset, routeZ);
  }

  routePositions.needsUpdate = true;
  routeGeo.computeBoundingSphere();
  asteroid.routeLine.computeLineDistances();

  const distanceRatio = THREE.MathUtils.clamp(distanceToPlanet / Math.max(0.0001, maxRadius), 0, 1);
  if (distanceRatio < 0.33) {
    routeMat.color.setHex(0xff3247);
  } else if (distanceRatio < 0.66) {
    routeMat.color.setHex(0xffb300);
  } else {
    routeMat.color.setHex(0x00d68f);
  }

  routeMat.dashOffset = -(currentTime * 0.22 * asteroid.routeSpeed);
  routeMat.opacity = 0.16 + 0.16 * (0.5 + 0.5 * Math.sin(currentTime * 1.4 + asteroid.routePhase));
}
