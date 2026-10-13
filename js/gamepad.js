/**
 * Cadillacs and Dinosaurs - Gamepad Detection & HUD Status
 * Supports Xbox, DualShock/DualSense, Nintendo Switch Pro, 8BitDo & standard HID gamepads.
 */

class ArcadeGamepadManager {
    constructor() {
        this.activeGamepads = new Map();
        this.statusElement = null;
        this.pollingInterval = null;
        this.init();
    }

    init() {
        window.addEventListener("gamepadconnected", (e) => this.onConnected(e));
        window.addEventListener("gamepaddisconnected", (e) => this.onDisconnected(e));

        // Poll for initial connection (some browsers require user gesture before event fires)
        this.checkExistingGamepads();
        window.addEventListener("pointerdown", () => this.checkExistingGamepads(), { once: true });
        window.addEventListener("keydown", () => this.checkExistingGamepads(), { once: true });
    }

    setStatusElement(el) {
        this.statusElement = el;
        this.updateHUD();
    }

    checkExistingGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of gamepads) {
            if (gp && !this.activeGamepads.has(gp.index)) {
                this.activeGamepads.set(gp.index, gp);
                this.showToast(`🎮 ${this.formatName(gp.id)} Connected!`, "success");
                this.updateHUD();
            }
        }
    }

    onConnected(event) {
        const gp = event.gamepad;
        this.activeGamepads.set(gp.index, gp);
        const name = this.formatName(gp.id);
        this.showToast(`🎮 ${name} Connected (Player ${gp.index + 1})`, "success");
        if (window.arcadeSFX) window.arcadeSFX.playStartSound();
        this.updateHUD();
    }

    onDisconnected(event) {
        const gp = event.gamepad;
        this.activeGamepads.delete(gp.index);
        this.showToast(`🎮 Controller Disconnected (P${gp.index + 1})`, "warn");
        this.updateHUD();
    }

    formatName(id) {
        if (!id) return "Gamepad";
        if (id.toLowerCase().includes("xbox")) return "Xbox Controller";
        if (id.toLowerCase().includes("wireless controller") || id.toLowerCase().includes("dualsense") || id.toLowerCase().includes("sony")) return "PlayStation Controller";
        if (id.toLowerCase().includes("switch") || id.toLowerCase().includes("pro controller")) return "Switch Pro Controller";
        if (id.toLowerCase().includes("8bitdo")) return "8BitDo Controller";
        // Clean up vendor/product hex IDs
        const cleaned = id.replace(/\(.*?\)/g, "").trim();
        return cleaned.length > 20 ? cleaned.slice(0, 20) + "…" : cleaned;
    }

    updateHUD() {
        if (!this.statusElement) return;

        if (this.activeGamepads.size === 0) {
            this.statusElement.innerHTML = `
                <span class="indicator-icon">⌨️</span>
                <span class="indicator-text">Keyboard Active</span>
            `;
            this.statusElement.classList.remove("connected");
        } else {
            const first = Array.from(this.activeGamepads.values())[0];
            this.statusElement.innerHTML = `
                <span class="indicator-icon pulse">🎮</span>
                <span class="indicator-text">${this.formatName(first.id)} (P1)</span>
            `;
            this.statusElement.classList.add("connected");
        }
    }

    showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `arcade-toast toast-${type}`;
        toast.textContent = message;
        
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            document.body.appendChild(container);
        }
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("show");
        }, 10);

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 3200);
    }
}

window.arcadeGamepad = new ArcadeGamepadManager();
