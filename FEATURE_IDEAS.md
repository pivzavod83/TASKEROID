## Gameplay and Task Mechanics
1 Task chains: allow dependencies so one asteroid only appears after another is completed.
2 Priority decay: lower urgency tasks slowly drift outward if ignored, while near-deadline tasks accelerate inward.
3 Focus mode: temporarily highlight one task asteroid and dim all others for distraction-free work.
4 Mission types: support repeatable tasks (daily/weekly) that respawn with new deadlines.

## How to Test in the Open App

1) Task chains (dependencies)
- Create Task A with no dependency.
- Create Task B and set Depends On = Task A.
- Expected: Task B is marked locked in the list and does not appear as an asteroid yet.
- Complete Task A.
- Expected: Task B unlocks and appears as an asteroid shortly after task list refresh.

2) Priority decay / urgency movement
- Create one low-priority task (importance 1-2) with a far deadline (for example 2-3 weeks).
- Create one high-urgency task with near deadline (today or tomorrow).
- Keep app open and watch positions over time.
- Expected: near-deadline asteroid moves inward faster; low-urgency low-priority asteroid tends to stay/drift farther out.
- Optional quick check: edit a task deadline from far future to near future and confirm it moves inward noticeably faster.

3) Focus mode
- In the task list, click FOCUS on one task.
- Expected: chosen task card becomes active, other cards dim.
- Expected in wallpaper: selected asteroid is emphasized while others are dimmed.
- Click UNFOCUS.
- Expected: all cards/asteroids return to normal intensity.

4) Mission types (daily/weekly repeat)
- Create a task with Repeat = Daily (or Weekly).
- Complete it.
- Expected: completion animation still plays.
- Expected after update: task remains active (does not disappear permanently) and deadline jumps to next valid day/week.
- Repeat once more to confirm it keeps respawning with advanced deadline.
