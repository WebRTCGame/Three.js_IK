import { _Math } from "../math/Math.js";
import { Solver } from "./Solver.js";

class HISolver extends Solver {
  constructor() {
    super();
  }
  get isIKSolver() {
    return true;
  }
}

export { HISolver };
