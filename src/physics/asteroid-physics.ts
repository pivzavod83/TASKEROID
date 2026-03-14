/**
 * Asteroid physics - time-based position and size mapping
 *
 * Distance calibration:
 * - 0 days remaining → asteroid almost touching planet (minRadius)
 * - 30 days remaining → asteroid near screen edge (maxRadius)
 * - timeRemaining = deadline - current_time
 * - progress = clamp(timeRemaining / maxTimeWindow, 0, 1)
 * - distance = minRadius + progress * (maxRadius - minRadius)
 */

import { Task } from '../models/task';

export const MAX_TIME_WINDOW_SEC = 30 * 24 * 3600; // 30 days in seconds
export const MIN_RADIUS = 1.8; // Just outside planet surface
export const MAX_RADIUS = 12; // Near screen boundary (responsive in renderer)
export const MIN_ASTEROID_SIZE = 0.2;
export const MAX_ASTEROID_SIZE = 0.9;

/**
 * Map importance (1-5) to asteroid size
 * importance 1 -> small, importance 5 -> large (hover-friendly)
 */
export function importanceToSize(importance: number): number {
  const t = Math.max(1, Math.min(5, importance));
  return MIN_ASTEROID_SIZE + ((t - 1) / 4) * (MAX_ASTEROID_SIZE - MIN_ASTEROID_SIZE);
}

/**
 * Compute distance from planet center
 * More time remaining = farther from planet
 * 0 days left -> minRadius, 30 days left -> maxRadius
 */
export function getAsteroidDistance(
  task: Task,
  currentTime: number,
  maxRadius: number = MAX_RADIUS
): number {
  const timeRemaining = Math.max(0, task.deadline - currentTime);
  const progress = Math.min(1, timeRemaining / MAX_TIME_WINDOW_SEC);
  return MIN_RADIUS + progress * (maxRadius - MIN_RADIUS);
}

/**
 * Check if asteroid has reached/collided with planet
 */
export function hasCollided(task: Task, currentTime: number): boolean {
  return currentTime >= task.deadline;
}
