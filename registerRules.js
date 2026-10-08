"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = void 0;
const core_game_1 = require("@civ-clone/core-game");
const Dependencies_1 = require("@civ-clone/base-strategy-ai/lib/Dependencies");
const turn_start_1 = require("./Rules/Player/turn-start");
const register = (game) => game.rules.register(...(0, turn_start_1.default)(game.strategies, game.strategyNotes, game.units, (0, Dependencies_1.dependenciesFor)(game)));
exports.register = register;
// The plugin loader imports each package for this side effect, as it does for `base-unit-action-goto`.
(0, exports.register)(core_game_1.defaultGame);
exports.default = exports.register;
//# sourceMappingURL=registerRules.js.map