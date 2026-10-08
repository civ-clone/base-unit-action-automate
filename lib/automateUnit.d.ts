import { TerrainImprovement } from '@civ-clone/base-strategy-terrain-work/lib/Unit/terrainWork';
import Automated from '../Busy/Automated';
import Dependencies from '@civ-clone/base-strategy-ai/lib/Dependencies';
import { PendingEffect } from '@civ-clone/core-pending-effect';
import Player from '@civ-clone/core-player/Player';
import StrategyRegistry from '@civ-clone/core-strategy/StrategyRegistry';
import Tile from '@civ-clone/core-world/Tile';
import Unit from '@civ-clone/core-unit/Unit';
export declare const generateKey: (unit: Unit) => string;
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
export declare const automated: () => Automated;
export declare const handBack: (unit: Unit, dependencies: Dependencies) => void;
export declare const automateUnit: (
  unit: Unit,
  strategyRegistry: StrategyRegistry,
  dependencies: Dependencies
) => boolean;
export declare const startAutomating: (
  unit: Unit,
  dependencies: Dependencies
) => void;
export default automateUnit;
