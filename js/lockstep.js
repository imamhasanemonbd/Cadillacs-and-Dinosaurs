/** Frame-numbered, buffered input exchange for the two-player LAN prototype. */
class DinoLockstep {
    constructor(send, apply, delay = 3) {
        this.send = send;
        this.apply = apply;
        this.delay = delay;
        this.frame = 0;
        this.mask = 0;
        this.pulses = 0;
        this.local = new Map();
        this.remote = new Map();
        this.sent = -1;
        for (let i = 0; i < delay; i++) { this.local.set(i, 0); this.remote.set(i, 0); }
    }
    receive(frame, mask) {
        if (!Number.isSafeInteger(frame) || frame < this.frame || frame > this.frame + 240 ||
            !Number.isInteger(mask) || mask < 0 || mask > 511) return false;
        this.remote.set(frame, mask);
        return true;
    }
    before() {
        const future = this.frame + this.delay;
        if (this.sent < future) {
            const mask = this.mask | this.pulses;
            this.pulses = 0;
            this.local.set(future, mask);
            this.send(future, mask);
            this.sent = future;
        }
        if (!this.remote.has(this.frame)) return false;
        this.apply(this.local.get(this.frame), this.remote.get(this.frame));
        return true;
    }
    after() {
        this.local.delete(this.frame);
        this.remote.delete(this.frame);
        this.frame++;
    }
}
window.DinoLockstep = DinoLockstep;
