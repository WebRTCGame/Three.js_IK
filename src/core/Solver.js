import { _Math } from "../math/Math.js";

class Solver {
  constructor() {
    this.startBones = null;
    this.endBones = null;

    this.target = null;
    this.goal = null;
    this.swivelAngle = 0;

    this.iteration = 40;

    this.thresholds = { position: 0.1, rotation: 0.1 };

    this.solver = null;
    this.chain = null;
  }
  get isSolver() {
    return true;
  }
}

export { Solver };