import { PICKUP_DURATION } from "./balance.js";
// A short press attempts one pickup. Holding repeats after each flight, without
// depending on OS key-repeat or queuing a burst when a tab resumes.
export class PickupHold {
  constructor() {
    this.cancel();
  }
  press(code, now) {
    if (this.code) return false;
    this.code = code;
    this.nextAt = now;
    return true;
  }
  take(now, busy = false) {
    if (!this.code || now < this.nextAt || busy) return false;
    this.nextAt = now + (PICKUP_DURATION * 1000 + 60);
    return true;
  }
  release(code) {
    if (code === this.code) this.cancel();
  }
  cancel() {
    this.code = null;
    this.nextAt = Infinity;
  }
}
