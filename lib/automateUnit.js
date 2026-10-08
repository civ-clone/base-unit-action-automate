"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAutomating = exports.automateUnit = exports.handBack = exports.automated = exports.generateKey = void 0;
// Improves the terrain with one worker for one turn, as a standing order from its player (civ-clone/web-renderer#200),
//  using the game's `TerrainWork` strategy (`base-strategy-terrain-work`). The order lives in a `StrategyNote`, so it
//  is saved with the game. On its way to a job the worker carries the `Automated` busy rule; once the job is under way
//  it carries the job's own (`BuildingRoad`, say), and the note records the job's `PendingEffect`, so the next turn can
//  tell a job still under way from one the player called off.
const StrategyNote_1 = require("@civ-clone/core-strategy/StrategyNote");
const terrainWork_1 = require("@civ-clone/base-strategy-terrain-work/lib/Unit/terrainWork");
const Automated_1 = require("../Busy/Automated");
const Criterion_1 = require("@civ-clone/core-rule/Criterion");
const Effect_1 = require("@civ-clone/core-rule/Effect");
const Path_1 = require("@civ-clone/core-world-path/Path");
const TerrainWork_1 = require("@civ-clone/base-strategy-terrain-work/Strategies/Unit/TerrainWork");
const UnitOrder_1 = require("@civ-clone/base-strategy-ai/PlayerActions/UnitOrder");
const enemyAdjacent_1 = require("@civ-clone/base-strategy-ai/lib/Unit/enemyAdjacent");
const OrderStrategy_1 = require("@civ-clone/base-strategy-ai/Strategies/lib/OrderStrategy");
const DataObject_1 = require("@civ-clone/core-data-object/DataObject");
const generateKey = (unit) => (0, StrategyNote_1.generateKey)(unit, 'automate');
exports.generateKey = generateKey;
// The `Automated` rule, built the same way fresh or restored. It never ends by itself: the order ends when the
//  strategy hands the worker back, or when the player gives it other orders.
const automated = () => new Automated_1.default(new Criterion_1.default(() => false), new Effect_1.default(() => { }));
exports.automated = automated;
const forget = (unit, dependencies, player) => {
    const note = dependencies.strategyNoteRegistry.getByKey((0, exports.generateKey)(unit)), memory = dependencies.memoryRegistry.memoryFor(player);
    if (note) {
        dependencies.strategyNoteRegistry.unregister(note);
    }
    (0, terrainWork_1.dropTerrainJob)(memory, unit);
    memory.unitPathData.delete(unit);
};
// Ends the order and gives the worker back to its player, with whatever moves it has left.
const handBack = (unit, dependencies) => {
    forget(unit, dependencies, unit.player());
    if (unit.destroyed()) {
        return;
    }
    unit.setBusy();
    unit.setActive();
};
exports.handBack = handBack;
// Whether `effect` is still owed: a job that finishes discharges its effect, which takes it out of the registry.
const outstanding = (dependencies, unit, effect) => dependencies.pendingEffectRegistry.getByTarget(unit).includes(effect);
// Whether the worker is still at the job the order started: it carries the job's busy rule, and the job's effect is
//  the latest it owes. Re-ordering a busy worker doesn't take its effect away, so another order would leave the effect
//  owed, but with a different busy rule, or a newer effect.
const stillWorking = (dependencies, unit, working) => {
    const busy = unit.busy();
    if (busy === null || (0, DataObject_1.typeNameOf)(busy.constructor) !== working.busy) {
        return false;
    }
    if (working.effect === null) {
        return true;
    }
    const owed = dependencies.pendingEffectRegistry.getByTarget(unit);
    return owed[owed.length - 1] === working.effect;
};
// After a load the strategy's memory is empty: the worker carries on with the job, along the path, the note says it
//  had, as `surveyTargets` takes up a saved survey rather than surveying again.
const resume = (unit, memory, order) => {
    const jobs = (0, terrainWork_1.terrainJobs)(memory);
    if (order.job && !jobs.has(unit)) {
        jobs.set(unit, {
            improvement: order.job.improvement,
            tile: order.job.tile,
        });
    }
    if (order.path.length > 0 && !memory.unitPathData.has(unit)) {
        memory.unitPathData.set(unit, new Path_1.default(...order.path));
    }
};
// Runs the order for the worker's turn, with the moves it has. Returns whether the order still stands. Synchronous, as
//  a `TurnStart` rule has to be.
const automateUnit = (unit, strategyRegistry, dependencies) => {
    var _a, _b, _c;
    const note = dependencies.strategyNoteRegistry.getByKey((0, exports.generateKey)(unit));
    if (!note) {
        return false;
    }
    const order = note.value(), player = unit.player();
    if (unit.destroyed() || order.player !== player) {
        forget(unit, dependencies, order.player);
        return false;
    }
    const busy = unit.busy();
    if (order.working !== null) {
        if (stillWorking(dependencies, unit, order.working)) {
            return true;
        }
        // Not working, and the job's effect was discharged: the job is done, so on to the next.
        if (busy === null &&
            (order.working.effect === null ||
                !outstanding(dependencies, unit, order.working.effect))) {
            order.working = null;
            unit.setBusy((0, exports.automated)());
        }
    }
    // Selecting a busy unit clears its busy rule, so the player has given it other orders: the order is over, and the
    //  unit is left as it is.
    if (!(unit.busy() instanceof Automated_1.default)) {
        forget(unit, dependencies, player);
        return false;
    }
    const strategy = (0, OrderStrategy_1.findStrategy)(strategyRegistry, TerrainWork_1.default);
    if (!strategy || (0, enemyAdjacent_1.default)(dependencies, player, unit)) {
        (0, exports.handBack)(unit, dependencies);
        return false;
    }
    const memory = dependencies.memoryRegistry.memoryFor(player);
    resume(unit, memory, order);
    // A busy unit isn't made active at the start of its turn, and the strategy only moves an active one.
    unit.setActive();
    const carryOn = strategy.order(new UnitOrder_1.default(player, unit));
    if (unit.destroyed()) {
        forget(unit, dependencies, player);
        return false;
    }
    if (!carryOn) {
        (0, exports.handBack)(unit, dependencies);
        return false;
    }
    const job = (0, terrainWork_1.terrainJobs)(memory).get(unit);
    order.job = job ? { improvement: job.improvement, tile: job.tile } : null;
    order.path = (_b = (_a = memory.unitPathData.get(unit)) === null || _a === void 0 ? void 0 : _a.entries()) !== null && _b !== void 0 ? _b : [];
    const after = unit.busy();
    if (after instanceof Automated_1.default) {
        unit.setActive(false);
        return true;
    }
    // Something other than a job changed what the worker is doing: the order is over.
    if (after === null) {
        forget(unit, dependencies, player);
        return false;
    }
    // The job is under way.
    const owed = dependencies.pendingEffectRegistry.getByTarget(unit);
    order.path = [];
    order.working = {
        busy: (0, DataObject_1.typeNameOf)(after.constructor),
        effect: (_c = owed[owed.length - 1]) !== null && _c !== void 0 ? _c : null,
    };
    return true;
};
exports.automateUnit = automateUnit;
// Starts the order for the worker, replacing any it had.
const startAutomating = (unit, dependencies) => {
    const memory = dependencies.memoryRegistry.memoryFor(unit.player());
    unit.setBusy((0, exports.automated)());
    (0, terrainWork_1.dropTerrainJob)(memory, unit);
    memory.unitPathData.delete(unit);
    dependencies.strategyNoteRegistry.replace(new StrategyNote_1.StrategyNote((0, exports.generateKey)(unit), {
        player: unit.player(),
        job: null,
        path: [],
        working: null,
    }));
};
exports.startAutomating = startAutomating;
exports.default = exports.automateUnit;
//# sourceMappingURL=automateUnit.js.map