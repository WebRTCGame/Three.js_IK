import { V3 } from "../math/V3.js";
import { J_BALL, J_GLOBAL, J_LOCAL, PI, TORAD } from "../constants.js";

class Joint3D {
  constructor() {
    this.rotor = PI;
    this.min = -PI;
    this.max = PI;

    this.freeHinge = true;

    this.rotationAxisUV = new V3();
    this.referenceAxisUV = new V3();
    this.type = J_BALL;
  }
  get isJoint3D() {
    return true;
  }

  clone() {
    var j = new Joint3D();

    j.type = this.type;
    j.rotor = this.rotor;
    j.max = this.max;
    j.min = this.min;
    j.freeHinge = this.freeHinge;
    j.rotationAxisUV.copy(this.rotationAxisUV);
    j.referenceAxisUV.copy(this.referenceAxisUV);

    return j;
  }

  testAngle() {
    if (this.max === PI && this.min === -PI) this.freeHinge = true;
    else this.freeHinge = false;
  }

  validateAngle(a) {
    a = a < 0 ? 0 : a;
    a = a > 180 ? 180 : a;
    return a;
  }

  setAsBallJoint(angle) {
    this.rotor = this.validateAngle(angle) * TORAD;
    this.type = J_BALL;
  }

  // Specify this joint to be a hinge with the provided settings

  setHinge(type, rotationAxis, clockwise, anticlockwise, referenceAxis) {
    this.type = type;
    if (clockwise < 0) clockwise *= -1;
    this.min = -this.validateAngle(clockwise) * TORAD;
    this.max = this.validateAngle(anticlockwise) * TORAD;

    this.testAngle();

    this.rotationAxisUV.copy(rotationAxis).normalize();
    this.referenceAxisUV.copy(referenceAxis).normalize();
  }

  // GET

  getHingeReferenceAxis() {
    return this.referenceAxisUV;
  }

  getHingeRotationAxis() {
    return this.rotationAxisUV;
  }

  // SET

  setBallJointConstraintDegs(angle) {
    this.rotor = this.validateAngle(angle) * TORAD;
  }

  setHingeClockwise(angle) {
    if (angle < 0) angle *= -1;
    this.min = -this.validateAngle(angle) * TORAD;
    this.testAngle();
  }

  setHingeAnticlockwise(angle) {
    this.max = this.validateAngle(angle) * TORAD;
    this.testAngle();
  }

  /*setHingeRotationAxis  ( axis ) {

        this.rotationAxisUV.copy( axis ).normalize();

    } 

    setHingeReferenceAxis  ( referenceAxis ) {

        this.referenceAxisUV.copy( referenceAxis ).normalize(); 

    } */
}

export { Joint3D };
