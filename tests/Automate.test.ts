import automateUnit, { AutomateNote, generateKey } from '../lib/automateUnit';
import {
  PendingEffect,
  instance as pendingEffectRegistryInstance,
} from '@civ-clone/core-pending-effect';
import { Settlers, Warrior } from '@civ-clone/civ1-unit/Units';
import testGame, { TestGame, knowledge } from './lib/testGame';
import Automate from '../Automate';
import Automated from '../Busy/Automated';
import { BuildRoad } from '@civ-clone/civ1-unit/Actions';
import City from '@civ-clone/core-city/City';
import Dependencies from '@civ-clone/base-strategy-ai/lib/Dependencies';
import Effect from '@civ-clone/core-rule/Effect';
import Player from '@civ-clone/core-player/Player';
import {
  TerrainPolicy,
  terrainJobs,
} from '@civ-clone/base-strategy-terrain-work/lib/Unit/terrainWork';
import TerrainWork from '@civ-clone/base-strategy-terrain-work/Strategies/Unit/TerrainWork';
import Tile from '@civ-clone/core-world/Tile';
import Tiles from '@civ-clone/core-city/Rules/Tiles';
import TurnStart from '@civ-clone/core-player/Rules/TurnStart';
import Unit from '@civ-clone/core-unit/Unit';
import { instance as busyRegistryInstance } from '@civ-clone/core-unit/BusyRegistry';
import { Road } from '@civ-clone/civ1-world/TileImprovements';
import Civilization from '@civ-clone/core-civilization/Civilization';
import { Game } from '@civ-clone/core-game/Game';
import { dependenciesFor } from '@civ-clone/base-strategy-ai/lib/Dependencies';
import { expect } from 'chai';
import { gameForLoad } from '@civ-clone/core-save-game/gameForLoad';
import { hydrate } from '@civ-clone/core-save-game/hydrate';
import { registerClasses } from '@civ-clone/core-save-game/registerClasses';
import { save } from '@civ-clone/core-save-game/save';
import { instance as tileImprovementRegistryInstance } from '@civ-clone/core-tile-improvement/TileImprovementRegistry';
import turnStart from '../Rules/Player/turn-start';

const at = (tile: Tile): string => `${tile.x()},${tile.y()}`;

// A road wanted on each of `tiles` (as `x,y`), until there is one. A finished road is built through the module's
//  registries, as `base-unit-action-build-road` builds it.
const roadsOn = (...tiles: string[]): TerrainPolicy => ({
  jobs: (dependencies, player, tile) =>
    tiles.includes(at(tile)) &&
    !tileImprovementRegistryInstance
      .getByTile(tile)
      .some((improvement): boolean => improvement instanceof Road)
      ? [{ improvement: 'road', value: 10, turns: 2 }]
      : [],
  workersWanted: () => 0,
});

type Setup = TestGame & {
  dependencies: Dependencies;
  player: Player;
  settlers: Settlers;
};

// A city at 3,3 whose tiles are everything within two tiles, and a worker at 1,3. The terrain jobs' effects are kept
//  in the module's registry, as `civ1-unit`'s actions register them there, as they are in a game.
const setUp = async (
  policy: TerrainPolicy | null = roadsOn('3,1')
): Promise<Setup> => {
  const setup = await testGame('49G', 7, 7),
    player = setup.addPlayer(),
    dependencies = {
      ...setup.dependencies,
      pendingEffectRegistry: pendingEffectRegistryInstance,
    };

  setup.game.rules.register(
    new Tiles(new Effect((city: City) => city.tile().getSurroundingArea(2)))
  );
  setup.game.cities.register(
    new City(
      player,
      setup.world.get(3, 3),
      'City',
      setup.game.rules,
      setup.game.workedTiles
    )
  );

  if (policy) {
    setup.game.strategies.register(
      new TerrainWork(dependencies, knowledge, policy, (): Promise<void> => {
        throw new Error('An order walks the unit itself.');
      })
    );
  }

  setup.game.rules.register(
    ...turnStart(
      setup.game.strategies,
      setup.game.strategyNotes,
      setup.game.units,
      dependencies
    )
  );

  return {
    ...setup,
    dependencies,
    player,
    settlers: setup.addUnit(Settlers, player, 1, 3),
  };
};

const automate = ({ dependencies, game }: Setup, unit: Unit): void =>
  unit.action(
    new Automate(
      unit.tile(),
      unit.tile(),
      unit,
      game.rules,
      game.strategies,
      game.strategyNotes,
      dependencies
    )
  );

// The start of the player's next turn, as `civ1-player`'s `reset-units` has it (moves given back, a finished busy rule
//  processed, a busy unit left inactive), then the turn-start rules.
const nextTurn = ({ game, player }: Setup): void => {
  game.turn.increment();
  game.units.getByPlayer(player).forEach((unit: Unit): void => {
    unit.moves().set(unit.movement());

    const busy = unit.busy();

    if (!busy) {
      unit.setActive();

      return;
    }

    if (busy.validate()) {
      busy.process();
    }
  });
  game.rules.process(TurnStart, player);
};

// The turn-start rules alone, with nothing come due: as at the start of a turn during a job that takes several.
const turnStartRules = ({ game, player }: Setup): void => {
  game.rules.process(TurnStart, player);
};

const noteFor = ({ game }: Setup, unit: Unit): AutomateNote | undefined =>
  game.strategyNotes.getByKey<AutomateNote>(generateKey(unit))?.value();

const busyName = (unit: Unit): string | null =>
  unit.busy()?.constructor.name ?? null;

describe('Automate', (): void => {
  it('should start the order and set off for a job straight away', async (): Promise<void> => {
    const setup = await setUp(),
      { player, settlers } = setup;

    automate(setup, settlers);

    expect(at(settlers.tile())).to.equal('2,2');
    expect(settlers.busy()).instanceOf(Automated);
    expect(settlers.active()).false;

    const note = noteFor(setup, settlers)!;

    expect(note.player).to.equal(player);
    expect(note.job?.improvement).to.equal('road');
    expect(at(note.job!.tile)).to.equal('3,1');
    expect(note.path.map(at)).to.deep.equal(['3,1']);
    expect(note.working).to.equal(null);
  });

  it('should do the job, then the next, and hand the worker back when there are none left', async (): Promise<void> => {
    const setup = await setUp(roadsOn('3,1', '4,1')),
      { settlers } = setup;

    automate(setup, settlers);
    nextTurn(setup);

    // There, with no moves left to start the job.
    expect(at(settlers.tile())).to.equal('3,1');
    expect(settlers.busy()).instanceOf(Automated);

    nextTurn(setup);

    // At work.
    expect(busyName(settlers)).to.equal('BuildingRoad');

    const note = noteFor(setup, settlers)!,
      effect = note.working!.effect as PendingEffect;

    expect(note.working!.busy).to.equal('BuildingRoad');
    expect(effect).instanceOf(PendingEffect);
    expect(note.path).to.deep.equal([]);

    // Still at work: left alone.
    turnStartRules(setup);

    expect(busyName(settlers)).to.equal('BuildingRoad');
    expect(noteFor(setup, settlers)?.working?.effect).to.equal(effect);

    // The road is done (its effect discharged), so on to the next job.
    nextTurn(setup);

    expect(pendingEffectRegistryInstance.getByTarget(settlers).includes(effect))
      .false;
    expect(at(settlers.tile())).to.equal('4,1');
    expect(settlers.busy()).instanceOf(Automated);
    expect(at(noteFor(setup, settlers)!.job!.tile)).to.equal('4,1');
    expect(noteFor(setup, settlers)!.working).to.equal(null);

    nextTurn(setup);

    expect(busyName(settlers)).to.equal('BuildingRoad');

    // And with no job left, the worker is handed back.
    nextTurn(setup);

    expect(settlers.busy()).to.equal(null);
    expect(settlers.active()).true;
    expect(noteFor(setup, settlers)).to.equal(undefined);
  });

  it('should end the order, leaving the worker be, when the player calls it away from a job', async (): Promise<void> => {
    const setup = await setUp(),
      { settlers } = setup;

    automate(setup, settlers);
    nextTurn(setup);
    nextTurn(setup);

    const { effect } = noteFor(setup, settlers)!.working!;

    // What selecting a busy unit does (`civ1-unit`'s `activate/clear-busy`). The job's effect is still owed: nothing
    //  takes it away.
    settlers.setBusy();
    settlers.setActive();

    expect(
      pendingEffectRegistryInstance
        .getByTarget(settlers)
        .includes(effect as PendingEffect)
    ).true;

    nextTurn(setup);

    expect(at(settlers.tile())).to.equal('3,1');
    expect(settlers.busy()).to.equal(null);
    expect(noteFor(setup, settlers)).to.equal(undefined);
  });

  it('should end the order when the player sets the worker to another job', async (): Promise<void> => {
    const setup = await setUp(),
      { settlers } = setup;

    automate(setup, settlers);
    nextTurn(setup);
    nextTurn(setup);

    const { effect } = noteFor(setup, settlers)!.working!;

    settlers.setBusy();
    settlers.setActive();
    settlers.moves().set(1);

    const [buildRoad] = settlers
      .actions()
      .filter((action): boolean => action instanceof BuildRoad);

    settlers.action(buildRoad);

    // The same busy rule, but a newer effect: the old one is still owed.
    expect(busyName(settlers)).to.equal('BuildingRoad');
    expect(pendingEffectRegistryInstance.getByTarget(settlers)).to.include(
      effect
    );

    turnStartRules(setup);

    expect(busyName(settlers)).to.equal('BuildingRoad');
    expect(noteFor(setup, settlers)).to.equal(undefined);
  });

  it('should hand the worker back, with its moves, when there is no job', async (): Promise<void> => {
    const setup = await setUp({ jobs: () => [], workersWanted: () => 0 }),
      { settlers } = setup;

    automate(setup, settlers);

    expect(at(settlers.tile())).to.equal('1,3');
    expect(settlers.busy()).to.equal(null);
    expect(settlers.active()).true;
    expect(settlers.moves().value()).to.equal(1);
    expect(noteFor(setup, settlers)).to.equal(undefined);
  });

  it('should hand the worker back when another player’s unit is near', async (): Promise<void> => {
    const setup = await setUp(),
      { addPlayer, addUnit, settlers } = setup;

    automate(setup, settlers);
    addUnit(Warrior, addPlayer(), 3, 1);
    nextTurn(setup);

    expect(at(settlers.tile())).to.equal('2,2');
    expect(settlers.busy()).to.equal(null);
    expect(settlers.active()).true;
    expect(noteFor(setup, settlers)).to.equal(undefined);
  });

  it('should hand the worker back straight away when the game has no TerrainWork strategy', async (): Promise<void> => {
    const setup = await setUp(null),
      { settlers } = setup;

    automate(setup, settlers);

    expect(at(settlers.tile())).to.equal('1,3');
    expect(settlers.busy()).to.equal(null);
    expect(settlers.active()).true;
    expect(settlers.moves().value()).to.equal(1);
    expect(noteFor(setup, settlers)).to.equal(undefined);
  });

  it('should take up the job and path in the note when its memory is gone, as after a load', async (): Promise<void> => {
    const wanted = ['3,1'],
      setup = await setUp({
        jobs: (dependencies, player, tile) =>
          wanted.includes(at(tile))
            ? [{ improvement: 'road', value: 10, turns: 2 }]
            : [],
        workersWanted: () => 0,
      }),
      { player, settlers } = setup;

    automate(setup, settlers);

    const memory = setup.dependencies.memoryRegistry.memoryFor(player);

    // A memory with nothing in it, as a game just loaded has, and a job that would come first were the worker choosing
    //  afresh.
    terrainJobs(memory).delete(settlers);
    memory.unitPathData.delete(settlers);
    wanted.push('2,2');

    nextTurn(setup);
    nextTurn(setup);

    expect(at(settlers.tile())).to.equal('3,1');
    expect(busyName(settlers)).to.equal('BuildingRoad');
  });

  it('should rebuild the busy rule after a load', async (): Promise<void> => {
    const { settlers } = await setUp(),
      busy = busyRegistryInstance.rebuild('Automated', settlers);

    expect(busy).instanceOf(Automated);
    expect(busy.validate()).false;
  });
  // Saves the game and loads it into another, as a player loading a saved game does: the game's own registries are
  //  fresh, and its players new objects, whose memories are empty.
  const saveAndLoad = (setup: Setup): Game => {
    const { game, player, settlers, world } = setup;

    player.setCivilization(new Civilization());
    // `civ1-unit`'s actions register the job's effect in the module's registry, which is the game's in a game.
    game.pendingEffects.register(
      ...pendingEffectRegistryInstance
        .getByTarget(settlers)
        .filter((effect) => !game.pendingEffects.includes(effect))
    );
    game.engine.registerPlugins({
      '@civ-clone/base-unit-action-automate': 'test',
    });
    registerClasses(game);
    game.classes.register(
      Settlers,
      ...world.entries().map((tile: Tile) => tile.terrain().sourceClass())
    );

    const loaded = gameForLoad({
      classes: game.classes,
      engine: game.engine,
      pathFinders: game.pathFinders,
      rules: game.rules,
    });

    hydrate(save(game, { name: 'test', createdAt: 0 }), loaded);

    return loaded;
  };

  it('should be saved with the game on its way to a job, and carry on to it after a load', async (): Promise<void> => {
    const setup = await setUp();

    automate(setup, setup.settlers);

    const loaded = saveAndLoad(setup),
      [restored] = loaded.units.entries(),
      [restoredPlayer] = loaded.players.entries(),
      note = loaded.strategyNotes
        .getByKey<AutomateNote>(generateKey(restored))!
        .value(),
      jobTile = restored.tile().map().get(3, 1);

    expect(restored).to.not.equal(setup.settlers);
    expect(restored.busy()).instanceOf(Automated);
    expect(note.player).to.equal(restoredPlayer);
    expect(note.job!.tile).to.equal(jobTile);
    expect(note.path).to.deep.equal([jobTile]);

    const dependencies = dependenciesFor(loaded);

    loaded.strategies.register(
      new TerrainWork(dependencies, knowledge, roadsOn('3,1', '2,2'), () =>
        Promise.resolve()
      )
    );
    restored.moves().set(1);

    expect(automateUnit(restored, loaded.strategies, dependencies)).true;
    expect(restored.tile()).to.equal(jobTile);
  });

  it('should be saved with the game part way through a job, and still be at it after a load', async (): Promise<void> => {
    const setup = await setUp();

    automate(setup, setup.settlers);
    nextTurn(setup);
    nextTurn(setup);

    const loaded = saveAndLoad(setup),
      [restored] = loaded.units.entries(),
      note = loaded.strategyNotes
        .getByKey<AutomateNote>(generateKey(restored))!
        .value(),
      dependencies = dependenciesFor(loaded);

    expect(busyName(restored)).to.equal('BuildingRoad');
    expect(note.working!.busy).to.equal('BuildingRoad');
    expect(loaded.pendingEffects.getByTarget(restored)).to.deep.equal([
      note.working!.effect,
    ]);

    loaded.strategies.register(
      new TerrainWork(dependencies, knowledge, roadsOn('3,1'), () =>
        Promise.resolve()
      )
    );

    expect(automateUnit(restored, loaded.strategies, dependencies)).true;
    expect(busyName(restored)).to.equal('BuildingRoad');
    expect(loaded.strategyNotes.getByKey(generateKey(restored))).to.not.equal(
      undefined
    );
  });
});
