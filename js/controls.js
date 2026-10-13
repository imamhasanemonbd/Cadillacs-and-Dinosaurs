/**
 * Cadillacs and Dinosaurs - Ultra-Smooth Mobile Virtual Arcade Controls
 * Multi-touch, zero-lag synthetic keyboard event dispatch with haptic feedback.
 */

class VirtualArcadeControls {
    constructor() {
        this.container = null;
        this.enabled = false;
        this.activeKeys = new Set();
        
        // Key mapping to standard EmulatorJS / RetroArch arcade keys
        // Player 1:
        // Coin: Digit5 / KeyC
        // Start: Digit1 / Enter
        // Up/Down/Left/Right: ArrowUp/Down/Left/Right or KeyW/S/A/D
        // Button A (Attack): KeyZ / KeyJ
        // Button B (Jump): KeyX / KeyK
        this.keyMap = {
            up: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
            down: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
            left: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
            right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
            btnA: { key: "z", code: "KeyZ", keyCode: 90 }, // Attack
            btnB: { key: "x", code: "KeyX", keyCode: 88 }, // Jump
            coin: { key: "5", code: "Digit5", keyCode: 53 },
            start: { key: "1", code: "Digit1", keyCode: 49 }
        };

        // Also dispatch alternate keys for maximum compatibility
        this.altKeyMap = {
            btnA: { key: "j", code: "KeyJ", keyCode: 74 },
            btnB: { key: "k", code: "KeyK", keyCode: 75 }
        };
    }

    init(containerEl) {
        this.container = containerEl;
        this.bindEvents();
        
        // Auto-enable if touch device
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (isTouch) {
            this.show();
        }
    }

    show() {
        if (!this.container) return;
        this.enabled = true;
        this.container.classList.remove("hidden");
    }

    hide() {
        if (!this.container) return;
        this.enabled = false;
        this.releaseAll();
        this.container.classList.add("hidden");
    }

    toggle() {
        if (this.enabled) {
            this.hide();
        } else {
            this.show();
        }
    }

    triggerHaptic(duration = 12) {
        if (navigator.vibrate) {
            try {
                navigator.vibrate(duration);
            } catch (_) {}
        }
    }

    dispatchKeyEvent(type, mapping) {
        const target = document.querySelector("#game-viewport canvas") || window;
        
        const eventInit = {
            key: mapping.key,
            code: mapping.code,
            keyCode: mapping.keyCode,
            which: mapping.keyCode,
            bubbles: true,
            cancelable: true,
            view: window
        };

        const ev = new KeyboardEvent(type, eventInit);
        target.dispatchEvent(ev);
        window.dispatchEvent(ev);
    }

    press(action) {
        if (this.activeKeys.has(action)) return;
        this.activeKeys.add(action);
        this.triggerHaptic(14);

        if (action === "special") {
            // A + B simultaneous press for special whirlwind/super
            this.press("btnA");
            this.press("btnB");
            return;
        }

        const map = this.keyMap[action];
        if (map) {
            this.dispatchKeyEvent("keydown", map);
        }
        const alt = this.altKeyMap[action];
        if (alt) {
            this.dispatchKeyEvent("keydown", alt);
        }
    }

    release(action) {
        if (!this.activeKeys.has(action) && action !== "special") return;
        this.activeKeys.delete(action);

        if (action === "special") {
            this.release("btnA");
            this.release("btnB");
            return;
        }

        const map = this.keyMap[action];
        if (map) {
            this.dispatchKeyEvent("keyup", map);
        }
        const alt = this.altKeyMap[action];
        if (alt) {
            this.dispatchKeyEvent("keyup", alt);
        }
    }

    releaseAll() {
        const keys = Array.from(this.activeKeys);
        for (const k of keys) {
            this.release(k);
        }
        this.activeKeys.clear();
    }

    bindEvents() {
        if (!this.container) return;

        // D-Pad buttons
        const dpadBtns = this.container.querySelectorAll("[data-dir]");
        dpadBtns.forEach(btn => {
            const dir = btn.getAttribute("data-dir");

            const handleStart = (e) => {
                e.preventDefault();
                btn.classList.add("active");
                if (dir.includes("-")) {
                    // Diagonal (e.g. up-left)
                    const [d1, d2] = dir.split("-");
                    this.press(d1);
                    this.press(d2);
                } else {
                    this.press(dir);
                }
            };

            const handleEnd = (e) => {
                e.preventDefault();
                btn.classList.remove("active");
                if (dir.includes("-")) {
                    const [d1, d2] = dir.split("-");
                    this.release(d1);
                    this.release(d2);
                } else {
                    this.release(dir);
                }
            };

            btn.addEventListener("touchstart", handleStart, { passive: false });
            btn.addEventListener("touchend", handleEnd, { passive: false });
            btn.addEventListener("touchcancel", handleEnd, { passive: false });
            btn.addEventListener("mousedown", handleStart);
            btn.addEventListener("mouseup", handleEnd);
            btn.addEventListener("mouseleave", handleEnd);
        });

        // Action Buttons (A, B, Special, Coin, Start)
        const actionBtns = this.container.querySelectorAll("[data-action]");
        actionBtns.forEach(btn => {
            const act = btn.getAttribute("data-action");

            const handleStart = (e) => {
                e.preventDefault();
                btn.classList.add("active");

                if (act === "coin" && window.arcadeSFX) {
                    window.arcadeSFX.playCoinSound();
                } else if (act === "start" && window.arcadeSFX) {
                    window.arcadeSFX.playStartSound();
                }

                this.press(act);
            };

            const handleEnd = (e) => {
                e.preventDefault();
                btn.classList.remove("active");
                this.release(act);
            };

            btn.addEventListener("touchstart", handleStart, { passive: false });
            btn.addEventListener("touchend", handleEnd, { passive: false });
            btn.addEventListener("touchcancel", handleEnd, { passive: false });
            btn.addEventListener("mousedown", handleStart);
            btn.addEventListener("mouseup", handleEnd);
            btn.addEventListener("mouseleave", handleEnd);
        });

        // Safety: release keys if window loses focus or pointer is canceled
        window.addEventListener("blur", () => this.releaseAll());
    }
}

window.virtualArcadeControls = new VirtualArcadeControls();
