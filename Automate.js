"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Automate = exports.handBack = exports.generateKey = exports.automated = void 0;
const Dependencies_1 = require("@civ-clone/base-strategy-ai/lib/Dependencies");
const RuleRegistry_1 = require("@civ-clone/core-rule/RuleRegistry");
const StrategyNoteRegistry_1 = require("@civ-clone/core-strategy/StrategyNoteRegistry");
const StrategyRegistry_1 = require("@civ-clone/core-strategy/StrategyRegistry");
const automateUnit_1 = require("./lib/automateUnit");
const Action_1 = require("@civ-clone/core-unit/Action");
const Automated_1 = require("./Busy/Automated");
const Moved_1 = require("@civ-clone/core-unit/Rules/Moved");
const BusyRegistry_1 = require("@civ-clone/core-unit/BusyRegistry");
var automateUnit_2 = require("./lib/automateUnit");
Object.defineProperty(exports, "automated", { enumerable: true, get: function () { return automateUnit_2.automated; } });
Object.defineProperty(exports, "generateKey", { enumerable: true, get: function () { return automateUnit_2.generateKey; } });
Object.defineProperty(exports, "handBack", { enumerable: true, get: function () { return automateUnit_2.handBack; } });
// Automate: a standing order for one of a player's workers to improve the terrain around the player's cities by itself,
//  job after job, using the game's `TerrainWork` strategy (civ-clone/web-renderer#200). It never founds a city, and
//  hands the worker back to its player when there's no job it can do, another player's unit is near, or the game has
//  no `TerrainWork` strategy at all.
class Automate extends Action_1.default {
    // `dependencies` are the registries the strategy's helpers read, the game's own (`dependenciesFor(game)`); any left
    //  out are the module singletons.
    constructor(from, to, unit, ruleRegistry = RuleRegistry_1.instance, strategyRegistry = StrategyRegistry_1.instance, strategyNoteRegistry = StrategyNoteRegistry_1.instance, dependencies = {}) {
        super(from, to, unit, ruleRegistry);
        this._strategyRegistry = strategyRegistry;
        this._dependencies = (0, Dependencies_1.createDependencies)({
            ruleRegistry,
            strategyNoteRegistry,
            ...dependencies,
        });
    }
    // Starts the order and gets on with it straight away, with the moves the worker has left.
    perform() {
        const unit = this.unit();
        (0, automateUnit_1.startAutomating)(unit, this._dependencies);
        (0, automateUnit_1.default)(unit, this._strategyRegistry, this._dependencies);
        if (!unit.destroyed()) {
            this.ruleRegistry().process(Moved_1.default, unit, this);
        }
    }
}
exports.Automate = Automate;
// Without this a worker saved on its way to a job fails to load. Nothing in the rule depends on the unit: what the
//  order needs is in its note, which is saved. A job under way is the job's own delayed action, which rebuilds itself.
BusyRegistry_1.instance.register(Automated_1.default, () => (0, automateUnit_1.automated)());
exports.default = Automate;
//# sourceMappingURL=Automate.js.map