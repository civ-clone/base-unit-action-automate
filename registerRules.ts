import { Game, defaultGame } from '@civ-clone/core-game';
import { dependenciesFor } from '@civ-clone/base-strategy-ai/lib/Dependencies';
import turnStart from './Rules/Player/turn-start';

export const register = (game: Game): void =>
  game.rules.register(
    ...turnStart(
      game.strategies,
      game.strategyNotes,
      game.units,
      dependenciesFor(game)
    )
  );

// The plugin loader imports each package for this side effect, as it does for `base-unit-action-goto`.
register(defaultGame);

export default register;
