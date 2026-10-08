import Dependencies from '@civ-clone/base-strategy-ai/lib/Dependencies';
import { StrategyNoteRegistry } from '@civ-clone/core-strategy/StrategyNoteRegistry';
import { StrategyRegistry } from '@civ-clone/core-strategy/StrategyRegistry';
import { UnitRegistry } from '@civ-clone/core-unit/UnitRegistry';
import TurnStart from '@civ-clone/core-player/Rules/TurnStart';
export declare const getRules: (
  strategyRegistry?: StrategyRegistry,
  strategyNoteRegistry?: StrategyNoteRegistry,
  unitRegistry?: UnitRegistry,
  dependencies?: Partial<Dependencies>
) => TurnStart[];
export default getRules;
