// Improves the terrain with one worker for one turn, as a standing order from its player (civ-clone/web-renderer#200),
//  using the game's `TerrainWork` strategy (`base-strategy-terrain-work`). The order lives in a `StrategyNote`, so it
//  is saved with the game. On its way to a job the worker carries the `Automated` busy rule; once the job is under way
//  it carries the job's own (`BuildingRoad`, say), and the note records the job's `PendingEffect`, so the next turn can
//  tell a job still under way from one the player called off.
import {
  StrategyNote,
  generateKey as generateRawKey,
} from '@civ-clone/core-strategy/StrategyNote';
import {
  TerrainImprovement,
  dropTerrainJob,
  terrainJobs,
} from '@civ-clone/base-strategy-terrain-work/lib/Unit/terrainWork';
import Automated from '../Busy/Automated';
import Criterion from '@civ-clone/core-rule/Criterion';
import Dependencies from '@civ-clone/base-strategy-ai/lib/Dependencies';
import Effect from '@civ-clone/core-rule/Effect';
import Memory from '@civ-clone/base-strategy-ai/lib/Memory';
import Path from '@civ-clone/core-world-path/Path';
import { PendingEffect } from '@civ-clone/core-pending-effect';
import Player from '@civ-clone/core-player/Player';
import StrategyRegistry from '@civ-clone/core-strategy/StrategyRegistry';
import TerrainWork from '@civ-clone/base-strategy-terrain-work/Strategies/Unit/TerrainWork';
import Tile from '@civ-clone/core-world/Tile';
import Unit from '@civ-clone/core-unit/Unit';
import UnitOrder from '@civ-clone/base-strategy-ai/PlayerActions/UnitOrder';
import enemyAdjacent from '@civ-clone/base-strategy-ai/lib/Unit/enemyAdjacent';
import { findStrategy } from '@civ-clone/base-strategy-ai/Strategies/lib/OrderStrategy';
import { typeNameOf } from '@civ-clone/core-data-object/DataObject';

export const generateKey = (unit: Unit): string =>
  generateRawKey(unit, 'automate');

// What a save keeps of the order: the player who gave it; the worker's job and the path to it, as tiles (never a
//  `Path`, which a save restores as a plain array: see `base-unit-action-goto`); and, once the job is under way, the
//  job's busy rule (its name) and the `PendingEffect` that finishes it.
export interface AutomateNote {
  player: Player;
  job: {
    improvement: TerrainImprovement;
    tile: Tile;
  } | null;
  path: Tile[];
  working: {
    busy: string;
    effect: PendingEffect | null;
  } | null;
}

// The `Automated` rule, built the same way fresh or restored. It never ends by itself: the order ends when the
//  strategy hands the worker back, or when the player gives it other orders.
export const automated = (): Automated =>
  new Automated(
    new Criterion((): boolean => false),
    new Effect((): void => {})
  );

const forget = (unit: Unit, dependencies: Dependencies, player: Player) => {
  const note = dependencies.strategyNoteRegistry.getByKey(generateKey(unit)),
    memory = dependencies.memoryRegistry.memoryFor(player);

  if (note) {
    dependencies.strategyNoteRegistry.unregister(note);
  }

  dropTerrainJob(memory, unit);
  memory.unitPathData.delete(unit);
};

// Ends the order and gives the worker back to its player, with whatever moves it has left.
export const handBack = (unit: Unit, dependencies: Dependencies): void => {
  forget(unit, dependencies, unit.player());

  if (unit.destroyed()) {
    return;
  }

  unit.setBusy();
  unit.setActive();
};

// Whether `effect` is still owed: a job that finishes discharges its effect, which takes it out of the registry.
const outstanding = (
  dependencies: Dependencies,
  unit: Unit,
  effect: PendingEffect
): boolean =>
  dependencies.pendingEffectRegistry.getByTarget(unit).includes(effect);

// Whether the worker is still at the job the order started: it carries the job's busy rule, and the job's effect is
//  the latest it owes. Re-ordering a busy worker doesn't take its effect away, so another order would leave the effect
//  owed, but with a different busy rule, or a newer effect.
const stillWorking = (
  dependencies: Dependencies,
  unit: Unit,
  working: NonNullable<AutomateNote['working']>
): boolean => {
  const busy = unit.busy();

  if (busy === null || typeNameOf(busy.constructor) !== working.busy) {
    return false;
  }

  if (working.effect === null) {
    return true;
  }

  const owed = dependencies.pendingEffectRegistry.getByTarget(unit);

  return owed[owed.length - 1] === working.effect;
};

// After a load the strategy's memory is empty: the worker carries on with the job, along the path, the note says it
//  had, as `surveyTargets` takes up a saved survey rather than surveying again.
const resume = (unit: Unit, memory: Memory, order: AutomateNote): void => {
  const jobs = terrainJobs(memory);

  if (order.job && !jobs.has(unit)) {
    jobs.set(unit, {
      improvement: order.job.improvement,
      tile: order.job.tile,
    });
  }

  if (order.path.length > 0 && !memory.unitPathData.has(unit)) {
    memory.unitPathData.set(unit, new Path(...order.path));
  }
};

// Runs the order for the worker's turn, with the moves it has. Returns whether the order still stands. Synchronous, as
//  a `TurnStart` rule has to be.
export const automateUnit = (
  unit: Unit,
  strategyRegistry: StrategyRegistry,
  dependencies: Dependencies
): boolean => {
  const note = dependencies.strategyNoteRegistry.getByKey<AutomateNote>(
    generateKey(unit)
  );

  if (!note) {
    return false;
  }

  const order = note.value(),
    player = unit.player();

  if (unit.destroyed() || order.player !== player) {
    forget(unit, dependencies, order.player);

    return false;
  }

  const busy = unit.busy();

  if (order.working !== null) {
    if (stillWorking(dependencies, unit, order.working)) {
      return true;
    }

    // Not working, and the job's effect was discharged: the job is done, so on to the next.
    if (
      busy === null &&
      (order.working.effect === null ||
        !outstanding(dependencies, unit, order.working.effect))
    ) {
      order.working = null;
      unit.setBusy(automated());
    }
  }

  // Selecting a busy unit clears its busy rule, so the player has given it other orders: the order is over, and the
  //  unit is left as it is.
  if (!(unit.busy() instanceof Automated)) {
    forget(unit, dependencies, player);

    return false;
  }

  const strategy = findStrategy(strategyRegistry, TerrainWork);

  if (!strategy || enemyAdjacent(dependencies, player, unit)) {
    handBack(unit, dependencies);

    return false;
  }

  const memory = dependencies.memoryRegistry.memoryFor(player);

  resume(unit, memory, order);

  // A busy unit isn't made active at the start of its turn, and the strategy only moves an active one.
  unit.setActive();

  const carryOn = strategy.order(new UnitOrder(player, unit));

  if (unit.destroyed()) {
    forget(unit, dependencies, player);

    return false;
  }

  if (!carryOn) {
    handBack(unit, dependencies);

    return false;
  }

  const job = terrainJobs(memory).get(unit);

  order.job = job ? { improvement: job.improvement, tile: job.tile } : null;
  order.path = memory.unitPathData.get(unit)?.entries() ?? [];

  const after = unit.busy();

  if (after instanceof Automated) {
    unit.setActive(false);

    return true;
  }

  // Something other than a job changed what the worker is doing: the order is over.
  if (after === null) {
    forget(unit, dependencies, player);

    return false;
  }

  // The job is under way.
  const owed = dependencies.pendingEffectRegistry.getByTarget(unit);

  order.path = [];
  order.working = {
    busy: typeNameOf(after.constructor),
    effect: owed[owed.length - 1] ?? null,
  };

  return true;
};

// Starts the order for the worker, replacing any it had.
export const startAutomating = (
  unit: Unit,
  dependencies: Dependencies
): void => {
  const memory = dependencies.memoryRegistry.memoryFor(unit.player());

  unit.setBusy(automated());

  dropTerrainJob(memory, unit);
  memory.unitPathData.delete(unit);
  dependencies.strategyNoteRegistry.replace(
    new StrategyNote<AutomateNote>(generateKey(unit), {
      player: unit.player(),
      job: null,
      path: [],
      working: null,
    })
  );
};

export default automateUnit;
