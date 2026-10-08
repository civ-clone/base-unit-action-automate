"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Automated = void 0;
const Busy_1 = require("@civ-clone/core-unit/Rules/Busy");
// A worker on a standing order to improve the terrain, while it's on its way to its next job. Once the job is under
//  way it carries the job's own busy rule instead (`BuildingRoad`, say).
class Automated extends Busy_1.default {
}
exports.Automated = Automated;
exports.default = Automated;
//# sourceMappingURL=Automated.js.map