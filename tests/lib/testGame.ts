// A small Civ1 world for testing a unit's moves: a game with Civ1's unit and world rules, a path finder, and players who
//  each know the whole map.
import Dependencies, {
  dependenciesFor,
} from '@civ-clone/base-strategy-ai/lib/Dependencies';
import BasePathFinder from '@civ-clone/simple-world-path/BasePathFinder';
import { Game } from '@civ-clone/core-game/Game';
import Knowledge from '@civ-clone/base-strategy-ai/lib/Knowledge';
import Player from '@civ-clone/core-player/Player';
import PlayerWorld from '@civ-clone/core-player-world/PlayerWorld';
import Tile from '@civ-clone/core-world/Tile';
import Unit from '@civ-clone/core-unit/Unit';
import World from '@civ-clone/core-world/World';
import simpleRLELoader from '@civ-clone/simple-world-generator/tests/lib/simpleRLELoader';
import unitRules from '@civ-clone/civ1-unit/registerRules';
import worldRules from '@civ-clone/civ1-world/registerRules';

export type TestGame = {
  dependencies: Dependencies;
  game: Game;
  world: World;
  // A player who knows the tiles `known` accepts: all of them by default.
  addPlayer: (known?: (tile: Tile) => boolean) => Player;
  addUnit: <T extends Unit>(
    UnitType: new (...args: any[]) => T,
    player: Player,
    x: number,
    y: number
  ) => T;
};

// No ruleset's judgement at all: every step can be come back from, and nothing is worth building.
export const knowledge: Knowledge = {
  assignWorkers: (): void => {},
  canReturnAfter: (): boolean => true,
  isAircraft: (): boolean => false,
  martialLaw: {
    limit: (): number => 0,
    wouldUse: (): boolean => false,
  },
  shouldBuildCity: (): boolean => false,
  shouldIrrigate: (): boolean => false,
  shouldMine: (): boolean => false,
  shouldRoad: (): boolean => false,
  unitSupport: (): number => 0,
};

// `map` is a `simpleRLELoader` map, `height` rows of `width` tiles.
export const testGame = async (
  map: string,
  height: number,
  width: number
): Promise<TestGame> => {
  const game = new Game();

  unitRules(game);
  worldRules(game);
  game.pathFinders.register(BasePathFinder);

  const world = await simpleRLELoader(game.rules, game.terrainFeatures)(
    map,
    height,
    width
  );

  return {
    dependencies: dependenciesFor(game),
    game,
    world,
    addPlayer: (known: (tile: Tile) => boolean = () => true): Player => {
      const player = new Player(game.rules);

      game.players.register(player);
      game.playerWorlds.register(new PlayerWorld(player, world));
      game.playerWorlds
        .getByPlayer(player)
        .register(...world.entries().filter(known));

      return player;
    },
    addUnit: <T extends Unit>(
      UnitType: new (...args: any[]) => T,
      player: Player,
      x: number,
      y: number
    ): T => {
      const unit = new UnitType(null, player, world.get(x, y), game.rules);

      if (!game.units.includes(unit)) {
        game.units.register(unit);
      }

      return unit;
    },
  };
};

export default testGame;
