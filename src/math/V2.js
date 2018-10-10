class V2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  get isVector2() {
    return true;
  }

  set(x = 0, y =0) {
    this.x = x;
    this.y = y;
    return this;
  }

  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }

  distanceToSquared(v) {
    var dx = this.x - v.x,
      dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    return this.divideScalar(this.length() || 1);
  }

  normalised() {
    return new V2(this.x, this.y).normalize();
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  plus(v) {
    return new V2(this.x + v.x, this.y + v.y);
  }

  min(v) {
    this.x -= v.x;
    this.y -= v.y;

    return this;
  }

  minus(v) {
    return new V2(this.x - v.x, this.y - v.y);
  }

  divideBy(value) {
    return new V2(this.x, this.y).divideScalar(value);
  }

  times(s) {
    if (s.isVector2) return new V2(this.x * s.x, this.y * s.y);
    else return new V2(this.x * s, this.y * s, this.z * s);
  }

  /*randomise: function ( min, max ) {

	    this.x = _Math.rand( min, max );
	    this.y = _Math.rand( min, max );
	    return this;

	},*/

  dot(a, b) {
    return this.x * a.x + this.y * a.y;
  }

  negate() {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }

  negated() {
    return new V2(-this.x, -this.y);
  }

  clone() {
    return new V2(this.x, this.y);
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  cross(v) {
    return this.x * v.y - this.y * v.x;
  }

  sign(v) {
    var s = this.cross(v);
    return s >= 0 ? 1 : -1;
  }

  approximatelyEquals(v, t) {
    if (t < 0) return false;
    var xDiff = Math.abs(this.x - v.x);
    var yDiff = Math.abs(this.y - v.y);
    return xDiff < t && yDiff < t;
  }

  rotate(angle) {
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    var x = this.x * cos - this.y * sin;
    var y = this.x * sin + this.y * cos;
    this.x = x;
    this.y = y;
    return this;
  }

  angleTo(v) {
    var a = this.dot(v) / Math.sqrt(this.lengthSq() * v.lengthSq());
    if (a <= -1) return Math.PI;
    if (a >= 1) return 0;
    return Math.acos(a);
  }

  getSignedAngle(v) {
    var a = this.angleTo(v);
    var s = this.sign(v);
    return s === 1 ? a : -a;
  }

  constrainedUV(baselineUV, min, max) {
    var angle = baselineUV.getSignedAngle(this);
    if (angle > max) this.copy(baselineUV).rotate(max);
    if (angle < min) this.copy(baselineUV).rotate(min);
    return this;
  }
}

export { V2 };
