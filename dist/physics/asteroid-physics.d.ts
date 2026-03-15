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
export declare const MAX_TIME_WINDOW_SEC: number;
export declare const DISTANCE_DECAY_SEC: number;
export declare const MIN_RADIUS = 2.35;
export declare const MAX_RADIUS = 12;
export declare const MIN_ASTEROID_SIZE = 0.2;
export declare const MAX_ASTEROID_SIZE = 0.9;
/**
 * Map importance (1-5) to asteroid size
 * importance 1 -> small, importance 5 -> large (hover-friendly)
 */
export declare function importanceToSize(importance: number): number;
/**
 * Compute distance from planet center
 * More time remaining = farther from planet
 * 0 days left -> minRadius, 30 days left -> maxRadius
 */
export declare function getAsteroidDistance(task: Task, currentTime: number, maxRadius?: number): number;
/**
 * Check if asteroid has reached/collided with planet
 */
export declare function hasCollided(task: Task, currentTime: number): boolean;
//# sourceMappingURL=asteroid-physics.d.ts.map