"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRules = void 0;
const Dependencies_1 = require("@civ-clone/base-strategy-ai/lib/Dependencies");
const StrategyNoteRegistry_1 = require("@civ-clone/core-strategy/StrategyNoteRegistry");
const StrategyRegistry_1 = require("@civ-clone/core-strategy/StrategyRegistry");
const UnitRegistry_1 = require("@civ-clone/core-unit/UnitRegistry");
const automateUnit_1 = require("../../lib/automateUnit");
const Effect_1 = require("@civ-clone/core-rule/Effect");
const Low_1 = require("@civ-clone/core-rule/Priorities/Low");
const TurnStart_1 = require("@civ-clone/core-player/Rules/TurnStart");
const getRules = (strategyRegistry = StrategyRegistry_1.instance, strategyNoteRegistry = StrategyNoteRegistry_1.instance, unitRegistry = UnitRegistry_1.instance, dependencies = {}) => {
    const resolved = (0, Dependencies_1.createDependencies)({
        strategyNoteRegistry,
        unitRegistry,
        ...dependencies,
    });
    return [
        new TurnStart_1.default('base-unit-action-automate:player/turn-start/automate', 
        // After the units' moves have been reset (`civ1-player`'s `reset-units`).
        new Low_1.default(), new Effect_1.default((player) => unitRegistry
            .getByPlayer(player)
            .filter((unit) => strategyNoteRegistry.getByKey((0, automateUnit_1.generateKey)(unit)) !== undefined)
            .forEach((unit) => {
            // One unit's failure ends its own order and nothing else: a throw here would stop the rest of the player's
            //  turn-start rules.
            try {
                (0, automateUnit_1.default)(unit, strategyRegistry, resolved);
            }
            catch (e) {
                (0, automateUnit_1.handBack)(unit, resolved);
            }
        }))),
    ];
};
exports.getRules = getRules;
exports.default = exports.getRules;
//# sourceMappingURL=turn-start.js.map