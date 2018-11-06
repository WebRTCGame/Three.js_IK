import { _Math } from "../math/Math.js";
import { Solver } from "./Solver.js";

class IKSolver extends Solver {
  constructor() {
    super();
  }
  get isIKSolver() {
    return true;
  }
}

export { IKSolver };
