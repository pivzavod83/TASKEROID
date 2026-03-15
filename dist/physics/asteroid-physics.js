"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ASTEROID_SIZE = exports.MIN_ASTEROID_SIZE = exports.MAX_RADIUS = exports.MIN_RADIUS = exports.DISTANCE_DECAY_SEC = exports.MAX_TIME_WINDOW_SEC = void 0;
exports.importanceToSize = importanceToSize;
exports.getAsteroidDistance = getAsteroidDistance;
exports.hasCollided = hasCollided;
exports.MAX_TIME_WINDOW_SEC = 30 * 24 * 3600; // 30 days reference window
exports.DISTANCE_DECAY_SEC = 10 * 24 * 3600; // 10 days: month-away tasks sit near outer ring
exports.MIN_RADIUS = 1.8; // Just outside planet surface
exports.MAX_RADIUS = 12; // Near screen boundary (responsive in renderer)
exports.MIN_ASTEROID_SIZE = 0.2;
exports.MAX_ASTEROID_SIZE = 0.9;
/**
 * Map importance (1-5) to asteroid size
 * importance 1 -> small, importance 5 -> large (hover-friendly)
 */
function importanceToSize(importance) {
    const t = Math.max(1, Math.min(5, importance));
    return exports.MIN_ASTEROID_SIZE + ((t - 1) / 4) * (exports.MAX_ASTEROID_SIZE - exports.MIN_ASTEROID_SIZE);
}
/**
 * Compute distance from planet center
 * More time remaining = farther from planet
 * 0 days left -> minRadius, 30 days left -> maxRadius
 */
function getAsteroidDistance(task, currentTime, maxRadius = exports.MAX_RADIUS) {
    const timeRemaining = Math.max(0, task.deadline - currentTime);
    // Monotonic mapping: more time left => farther, always bounded inside maxRadius.
    const progress = 1 - Math.exp(-timeRemaining / exports.DISTANCE_DECAY_SEC);
    return exports.MIN_RADIUS + progress * (maxRadius - exports.MIN_RADIUS);
}
/**
 * Check if asteroid has reached/collided with planet
 */
function hasCollided(task, currentTime) {
    return currentTime >= task.deadline;
}
//# sourceMappingURL=asteroid-physics.js.map