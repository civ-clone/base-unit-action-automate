import Dependencies from '@civ-clone/base-strategy-ai/lib/Dependencies';
import { RuleRegistry } from '@civ-clone/core-rule/RuleRegistry';
import { StrategyNoteRegistry } from '@civ-clone/core-strategy/StrategyNoteRegistry';
import { StrategyRegistry } from '@civ-clone/core-strategy/StrategyRegistry';
import Action from '@civ-clone/core-unit/Action';
import Tile from '@civ-clone/core-world/Tile';
import Unit from '@civ-clone/core-unit/Unit';
export type { AutomateNote } from './lib/automateUnit';
export { automated, generateKey, handBack } from './lib/automateUnit';
export declare class Automate extends Action {
  private _dependencies;
  private _strategyRegistry;
  constructor(
    from: Tile,
    to: Tile,
    unit: Unit,
    ruleRegistry?: RuleRegistry,
    strategyRegistry?: StrategyRegistry,
    strategyNoteRegistry?: StrategyNoteRegistry,
    dependencies?: Partial<Dependencies>
  );
  perform(): void;
}
export default Automate;
