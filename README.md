# base-unit-action-automate

The `Automate` unit action: a standing order for a worker to improve the terrain around its player's cities by itself,
job after job (civ-clone/web-renderer#200). It runs the game's `TerrainWork` strategy from
[`base-strategy-terrain-work`](https://github.com/civ-clone/base-strategy-terrain-work), found in `game.strategies`,
so the worker picks its jobs the way the computer players' workers do, but never founds a city.

- `Automate`: `new Automate(from, to, unit, ruleRegistry, strategyRegistry, strategyNoteRegistry, dependencies)`. Its
  `perform` gives the worker the `Automated` busy rule, records the order in a `StrategyNote` (`generateKey(unit)`)
  and gets on with it straight away with the moves the worker has left.
- On its way to a job the worker carries `Automated`. Once the job is under way it carries the job's own busy rule
  (`BuildingRoad`, say), and the note records that rule's name and the job's `PendingEffect`.
- `Rules/Player/turn-start`: at the start of each of the player's turns (`Low`, after the units' moves are reset and
  finished jobs completed), each worker with the order carries on: travelling, it walks on; at work, it's left alone;
  with its job done (the effect discharged), it takes the next. One worker's failure hands back that worker alone.
- The worker is handed back to its player (no longer busy, active, with any moves it has left, and the note dropped)
  when there's no job it can do, when another player's unit is near, or straight away when the game has no
  `TerrainWork` strategy. Selecting the worker (which clears its busy rule) or setting it to another job ends the
  order and leaves the worker be: re-ordering a busy worker leaves the old job's effect owed, so the note tells the
  two apart by the busy rule and the latest effect the worker owes.
- Saved games: the note holds the player, the job, the path to it as tiles (never a `Path`) and, at work, the job's
  effect as a reference. The `Automated` busy rule is registered with `core-unit`'s `BusyRegistry`. After a load the
  worker takes up the same job.
- `registerRules(game)` registers the turn-start rule against a game's registries; importing the package registers it
  for `defaultGame`.
