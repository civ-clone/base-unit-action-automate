import Dependencies, {
  createDependencies,
} from '@civ-clone/base-strategy-ai/lib/Dependencies';
import {
  RuleRegistry,
  instance as ruleRegistryInstance,
} from '@civ-clone/core-rule/RuleRegistry';
import {
  StrategyNoteRegistry,
  instance as strategyNoteRegistryInstance,
} from '@civ-clone/core-strategy/StrategyNoteRegistry';
import {
  StrategyRegistry,
  instance as strategyRegistryInstance,
} from '@civ-clone/core-strategy/StrategyRegistry';
import automateUnit, { automated, startAutomating } from './lib/automateUnit';
import Action from '@civ-clone/core-unit/Action';
import Automated from './Busy/Automated';
import Moved from '@civ-clone/core-unit/Rules/Moved';
import Tile from '@civ-clone/core-world/Tile';
import Unit from '@civ-clone/core-unit/Unit';
import { instance as busyRegistryInstance } from '@civ-clone/core-unit/BusyRegistry';

export type { AutomateNote } from './lib/automateUnit';
export { automated, generateKey, handBack } from './lib/automateUnit';

// Automate: a standing order for one of a player's workers to improve the terrain around the player's cities by itself,
//  job after job, using the game's `TerrainWork` strategy (civ-clone/web-renderer#200). It never founds a city, and
//  hands the worker back to its player when there's no job it can do, another player's unit is near, or the game has
//  no `TerrainWork` strategy at all.
export class Automate extends Action {
  private _dependencies: Dependencies;
  private _strategyRegistry: StrategyRegistry;

  // `dependencies` are the registries the strategy's helpers read, the game's own (`dependenciesFor(game)`); any left
  //  out are the module singletons.
  constructor(
    from: Tile,
    to: Tile,
    unit: Unit,
    ruleRegistry: RuleRegistry = ruleRegistryInstance,
    strategyRegistry: StrategyRegistry = strategyRegistryInstance,
    strategyNoteRegistry: StrategyNoteRegistry = strategyNoteRegistryInstance,
    dependencies: Partial<Dependencies> = {}
  ) {
    super(from, to, unit, ruleRegistry);

    this._strategyRegistry = strategyRegistry;
    this._dependencies = createDependencies({
      ruleRegistry,
      strategyNoteRegistry,
      ...dependencies,
    });
  }

  // Starts the order and gets on with it straight away, with the moves the worker has left.
  perform(): void {
    const unit = this.unit();

    startAutomating(unit, this._dependencies);
    automateUnit(unit, this._strategyRegistry, this._dependencies);

    if (!unit.destroyed()) {
      this.ruleRegistry().process(Moved, unit, this);
    }
  }
}

// Without this a worker saved on its way to a job fails to load. Nothing in the rule depends on the unit: what the
//  order needs is in its note, which is saved. A job under way is the job's own delayed action, which rebuilds itself.
busyRegistryInstance.register(Automated, (): Automated => automated());

export default Automate;
