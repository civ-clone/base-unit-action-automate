import Dependencies, {
  createDependencies,
} from '@civ-clone/base-strategy-ai/lib/Dependencies';
import {
  StrategyNoteRegistry,
  instance as strategyNoteRegistryInstance,
} from '@civ-clone/core-strategy/StrategyNoteRegistry';
import {
  StrategyRegistry,
  instance as strategyRegistryInstance,
} from '@civ-clone/core-strategy/StrategyRegistry';
import {
  UnitRegistry,
  instance as unitRegistryInstance,
} from '@civ-clone/core-unit/UnitRegistry';
import automateUnit, { generateKey, handBack } from '../../lib/automateUnit';
import Effect from '@civ-clone/core-rule/Effect';
import Low from '@civ-clone/core-rule/Priorities/Low';
import Player from '@civ-clone/core-player/Player';
import TurnStart from '@civ-clone/core-player/Rules/TurnStart';
import Unit from '@civ-clone/core-unit/Unit';

export const getRules = (
  strategyRegistry: StrategyRegistry = strategyRegistryInstance,
  strategyNoteRegistry: StrategyNoteRegistry = strategyNoteRegistryInstance,
  unitRegistry: UnitRegistry = unitRegistryInstance,
  dependencies: Partial<Dependencies> = {}
): TurnStart[] => {
  const resolved = createDependencies({
    strategyNoteRegistry,
    unitRegistry,
    ...dependencies,
  });

  return [
    new TurnStart(
      'base-unit-action-automate:player/turn-start/automate',
      // After the units' moves have been reset (`civ1-player`'s `reset-units`).
      new Low(),
      new Effect((player: Player): void =>
        unitRegistry
          .getByPlayer(player)
          .filter(
            (unit: Unit): boolean =>
              strategyNoteRegistry.getByKey(generateKey(unit)) !== undefined
          )
          .forEach((unit: Unit): void => {
            // One unit's failure ends its own order and nothing else: a throw here would stop the rest of the player's
            //  turn-start rules.
            try {
              automateUnit(unit, strategyRegistry, resolved);
            } catch (e) {
              handBack(unit, resolved);
            }
          })
      )
    ),
  ];
};

export default getRules;
