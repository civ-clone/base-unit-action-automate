import Busy from '@civ-clone/core-unit/Rules/Busy';

// A worker on a standing order to improve the terrain, while it's on its way to its next job. Once the job is under
//  way it carries the job's own busy rule instead (`BuildingRoad`, say).
export class Automated extends Busy {}

export default Automated;
