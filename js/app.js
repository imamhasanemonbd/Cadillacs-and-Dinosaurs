/**
 * Cadillacs and Dinosaurs Web Arcade - Main Application Controller
 * Handles EmulatorJS lifecycle, Fullscreen API, CRT shaders, ROM loading, and UI events.
 */

class DinoArcadeApp {
    constructor() {
        this.emulatorLoaded = false;
        this.gameStarted = false;
        this.credits = 0;
        this.crtEnabled = true;
        this.viewMode = 'fullscreen'; // 'fullscreen' or 'cabinet'
        this.romUrl = 'roms/dino.zip';
        this.fallbackRomUrl = 'https://archive.org/download/cadillacs-and-dinosaurs-world/dino.zip';
        
        // Single coin debounce guard
        this.isCoinDebouncing = false;

        // Fast In-Game Cheats (Direct CPS-1 RAM Poking)
        this.cheats = { immortal: false, ammo: false };
        this.cheatRafId = null;
        this.cheatInterval = null;
        this.cheatRunning = false;

        // Dynamic Loading synchronization
        this.progressObserver = null;
        this.startupCheckInterval = null;
        this.gameReadyDismissed = false;
        
        this.elements = {};
    }

    init() {
        this.initRamBaseDetector();
        this.cacheDOMElements();
        this.bindUIEvents();
        this.renderCharacterModal();
        this.setupDropZone();
        
        // Connect gamepad status indicator
        if (window.arcadeGamepad && this.elements.gamepadIndicator) {
            window.arcadeGamepad.setStatusElement(this.elements.gamepadIndicator);
        }

        // Keep mobile landscape handling; EmulatorJS renders the touch controls.
        if (window.virtualArcadeControls &&
            ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
            window.virtualArcadeControls.setupLandscape();
        }

        // Keyboard hotkeys
        this.bindKeyboardShortcuts();

        // Check if device is mobile to auto-suggest full view
        if (window.innerWidth <= 768) {
            this.setViewMode('fullscreen');
        }

        this.startGame();
    }

    cacheDOMElements() {
        this.elements = {
            viewportContainer: document.getElementById('arcade-viewport-container'),
            gameViewport: document.getElementById('game-viewport'),
            btnInsertCoin: document.getElementById('btn-insert-coin'),
            btnStartP1: document.getElementById('btn-start-p1'),
            btnCheatImmortal: document.getElementById('btn-cheat-immortal'),
            btnCheatAmmo: document.getElementById('btn-cheat-ammo'),
            liveHud: document.getElementById('arcade-live-hud'),
            hudBtnCoin: document.getElementById('hud-btn-coin'),
            hudBtnStart: document.getElementById('hud-btn-start'),
            hudBtnCheatImmortal: document.getElementById('hud-btn-cheat-immortal'),
            hudBtnCheatAmmo: document.getElementById('hud-btn-cheat-ammo'),
            hudStatusImmortal: document.getElementById('hud-status-immortal'),
            hudStatusAmmo: document.getElementById('hud-status-ammo'),
            creditsDisplay: document.getElementById('credits-counter'),
            btnFullscreen: document.getElementById('btn-toggle-fullscreen'),
            btnCrt: document.getElementById('btn-toggle-crt'),
            btnViewMode: document.getElementById('btn-toggle-viewmode'),
            btnTouchToggle: document.getElementById('btn-toggle-touch'),
            btnMoves: document.getElementById('btn-show-moves'),
            btnHelp: document.getElementById('btn-show-help'),
            btnMute: document.getElementById('btn-toggle-mute'),
            movesModal: document.getElementById('moves-modal'),
            helpModal: document.getElementById('help-modal'),
            closeButtons: document.querySelectorAll('.modal-close'),
            touchControls: document.getElementById('virtual-touch-controls'),
            gamepadIndicator: document.getElementById('gamepad-status-indicator'),
            crtOverlay: document.getElementById('crt-overlay'),
            romFileInput: document.getElementById('custom-rom-input')
        };
    }

    bindUIEvents() {
        // Insert Coin toolbar button
        this.elements.btnInsertCoin?.addEventListener('click', () => {
            this.insertCoin();
        });

        // 1P Start toolbar button
        this.elements.btnStartP1?.addEventListener('click', () => {
            this.pressStart();
        });

        // Live In-Game Floating HUD Buttons
        this.elements.hudBtnCoin?.addEventListener('click', () => {
            this.insertCoin();
        });

        this.elements.hudBtnStart?.addEventListener('click', () => {
            this.pressStart();
        });

        // Fast In-Game Cheats: Immortal and Unlimited Ammo
        this.elements.btnCheatImmortal?.addEventListener('click', () => {
            this.toggleCheat('immortal');
        });

        this.elements.btnCheatAmmo?.addEventListener('click', () => {
            this.toggleCheat('ammo');
        });

        this.elements.hudBtnCheatImmortal?.addEventListener('click', () => {
            this.toggleCheat('immortal');
        });

        this.elements.hudBtnCheatAmmo?.addEventListener('click', () => {
            this.toggleCheat('ammo');
        });

        // Force Enter Game Button
        this.elements.btnForceEnter?.addEventListener('click', () => {
            this.forceEnterGame();
        });

        // Fullscreen Toggle
        this.elements.btnFullscreen?.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // CRT Shader Toggle
        this.elements.btnCrt?.addEventListener('click', () => {
            this.toggleCRT();
        });

        // Cabinet vs Fullscreen Viewport Mode
        this.elements.btnViewMode?.addEventListener('click', () => {
            this.toggleViewMode();
        });

        // Touch controls visibility toggle
        this.elements.btnTouchToggle?.addEventListener('click', () => {
            if (window.virtualArcadeControls) {
                window.virtualArcadeControls.toggle();
                const isShown = window.virtualArcadeControls.enabled;
                this.elements.btnTouchToggle.classList.toggle('active', isShown);
                this.showToast(isShown ? '🕹️ Touch Controls Enabled' : '🕹️ Touch Controls Hidden');
            }
        });

        // Sound Mute Toggle
        this.elements.btnMute?.addEventListener('click', () => {
            this.toggleMute();
        });

        // Modals
        this.elements.btnMoves?.addEventListener('click', () => {
            if (window.arcadeSFX) window.arcadeSFX.playClick();
            this.elements.movesModal?.classList.add('open');
        });

        this.elements.btnHelp?.addEventListener('click', () => {
            if (window.arcadeSFX) window.arcadeSFX.playClick();
            this.elements.helpModal?.classList.add('open');
        });

        this.elements.closeButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.arcadeSFX) window.arcadeSFX.playClick();
                document.querySelectorAll('.arcade-modal').forEach(m => m.classList.remove('open'));
            });
        });

        // Backdrop click to close modals
        document.querySelectorAll('.arcade-modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('open');
                }
            });
        });

        // Custom ROM File Upload
        this.elements.romFileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadCustomROMFile(file);
            }
        });

        // Fullscreen change listener
        document.addEventListener('fullscreenchange', () => {
            const isFull = !!document.fullscreenElement;
            this.elements.btnFullscreen?.classList.toggle('active', isFull);
        });
    }

    bindKeyboardShortcuts() {
        this.pressedKeys = new Set();
        this.buttonRefCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

        const getButtonForCode = (code, key) => {
            const k = (key || '').toLowerCase();
            // 8-Way Movement: Up (4), Down (5), Left (6), Right (7)
            if (code === 'KeyW' || k === 'w' || code === 'ArrowUp') return 4;
            if (code === 'KeyS' || k === 's' || code === 'ArrowDown') return 5;
            if (code === 'KeyA' || k === 'a' || code === 'ArrowLeft') return 6;
            if (code === 'KeyD' || k === 'd' || code === 'ArrowRight') return 7;

            // Attack (8): J or Z
            if (code === 'KeyJ' || k === 'j' || code === 'KeyZ' || k === 'z') return 8;

            // Jump (0): K or X
            if (code === 'KeyK' || k === 'k' || code === 'KeyX' || k === 'x') return 0;

            return null;
        };

        const isSpecialMove = (code, key) => {
            const k = (key || '').toLowerCase();
            return code === 'KeyL' || k === 'l' || code === 'Space' || k === ' ';
        };

        const sendSimulate = (buttonId, state) => {
            if (window.EJS_emulator && window.EJS_emulator.gameManager && typeof window.EJS_emulator.gameManager.simulateInput === 'function') {
                try {
                    window.EJS_emulator.gameManager.simulateInput(0, buttonId, state);
                } catch (_) {}
            }
        };

        window.addEventListener('keydown', (e) => {
            // Prevent interference if user is in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Hotkeys: Fullscreen (F), Cheats (G, U), Modals (Esc)
            if (e.key === 'g' || e.key === 'G') {
                this.toggleCheat('immortal');
                return;
            }
            if (e.key === 'u' || e.key === 'U') {
                this.toggleCheat('ammo');
                return;
            }
            if (e.key === 'f' || e.key === 'F') {
                if (!e.ctrlKey && !e.metaKey) {
                    this.toggleFullscreen();
                    return;
                }
            }
            if (e.key === 'Escape') {
                document.querySelectorAll('.arcade-modal').forEach(m => m.classList.remove('open'));
                return;
            }

            // Coin keys: 5, c, C, v, V
            if (e.key === '5' || e.code === 'Digit5' || e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V') {
                this.insertCoin();
                return;
            }

            // 1P Start keys: 1, Digit1, Enter
            if (e.key === '1' || e.code === 'Digit1' || e.key === 'Enter') {
                this.pressStart();
                return;
            }

            if (e.repeat) return; // Prevent browser repeat stutter
            const normKey = e.code || e.key;

            // Special Move (A + B Whirlwind Kick): L or Spacebar
            if (isSpecialMove(e.code, e.key)) {
                e.preventDefault();
                if (!this.pressedKeys.has(normKey)) {
                    this.pressedKeys.add(normKey);
                    this.buttonRefCounts[8]++;
                    this.buttonRefCounts[0]++;
                    sendSimulate(8, 1);
                    sendSimulate(0, 1);
                }
                return;
            }

            // Primary Arcade Controls (WASD, Arrows, J, K, Z, X)
            const buttonId = getButtonForCode(e.code, e.key);
            if (buttonId !== null) {
                // Prevent browser page scrolling
                e.preventDefault();

                if (!this.pressedKeys.has(normKey)) {
                    this.pressedKeys.add(normKey);
                    this.buttonRefCounts[buttonId]++;
                    if (this.buttonRefCounts[buttonId] === 1) {
                        sendSimulate(buttonId, 1);
                    }
                }
            }
        }, { capture: true });

        window.addEventListener('keyup', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const normKey = e.code || e.key;

            if (isSpecialMove(e.code, e.key)) {
                if (this.pressedKeys.has(normKey)) {
                    this.pressedKeys.delete(normKey);
                    this.buttonRefCounts[8] = Math.max(0, this.buttonRefCounts[8] - 1);
                    this.buttonRefCounts[0] = Math.max(0, this.buttonRefCounts[0] - 1);
                    if (this.buttonRefCounts[8] === 0) sendSimulate(8, 0);
                    if (this.buttonRefCounts[0] === 0) sendSimulate(0, 0);
                }
                return;
            }

            const buttonId = getButtonForCode(e.code, e.key);
            if (buttonId !== null) {
                if (this.pressedKeys.has(normKey)) {
                    this.pressedKeys.delete(normKey);
                    this.buttonRefCounts[buttonId] = Math.max(0, this.buttonRefCounts[buttonId] - 1);
                    if (this.buttonRefCounts[buttonId] === 0) {
                        sendSimulate(buttonId, 0);
                    }
                }
            }
        }, { capture: true });

        // On window blur, release all buttons to prevent stuck movement
        window.addEventListener('blur', () => {
            if (this.pressedKeys) this.pressedKeys.clear();
            for (let b = 0; b <= 8; b++) {
                if (this.buttonRefCounts) this.buttonRefCounts[b] = 0;
                sendSimulate(b, 0);
            }
        });
    }

    focusGameCanvas() {
        const viewport = document.getElementById('game-viewport');
        const canvas = viewport?.querySelector('canvas');
        if (canvas) {
            canvas.focus();
        } else if (viewport) {
            viewport.focus();
        }
    }

    insertCoin() {
        if (this.isCoinDebouncing) return;
        this.isCoinDebouncing = true;
        setTimeout(() => { this.isCoinDebouncing = false; }, 350);

        this.credits++;
        if (this.elements.creditsDisplay) {
            this.elements.creditsDisplay.textContent = String(this.credits).padStart(2, '0');
        }

        if (window.arcadeSFX) {
            window.arcadeSFX.playCoinSound();
        }

        // Animate coin button
        if (this.elements.btnInsertCoin) {
            this.elements.btnInsertCoin.classList.add('coin-inserted');
            setTimeout(() => this.elements.btnInsertCoin.classList.remove('coin-inserted'), 250);
        }

        // Direct C-level WASM injection into RetroArch/FBNeo core (Button 2 is INSERT COIN!)
        // 45ms pulse ensures exactly 1 coin is registered without multi-tick chute bounce
        let coinSent = false;
        if (window.EJS_emulator && window.EJS_emulator.gameManager && typeof window.EJS_emulator.gameManager.simulateInput === 'function') {
            try {
                window.EJS_emulator.gameManager.simulateInput(0, 2, 1);
                setTimeout(() => {
                    try {
                        if (window.EJS_emulator && window.EJS_emulator.gameManager) {
                            window.EJS_emulator.gameManager.simulateInput(0, 2, 0);
                        }
                    } catch (_) {}
                }, 45);
                coinSent = true;
            } catch (_) {}
        }

        // Fallback to synthetic key ONLY if simulateInput was NOT available
        if (!coinSent && this.gameStarted && window.virtualArcadeControls) {
            window.virtualArcadeControls.press('coin');
            setTimeout(() => window.virtualArcadeControls.release('coin'), 45);
        }

        // Focus canvas
        this.focusGameCanvas();

        // Make 1P Start button pulse inviting the player to start!
        if (this.elements.btnStartP1) {
            this.elements.btnStartP1.classList.add('ready-to-start');
        }
        if (this.elements.hudBtnStart) {
            this.elements.hudBtnStart.classList.add('pulse');
        }

        this.showToast(`🪙 1 Coin Added (${this.credits} Credit${this.credits > 1 ? 's' : ''}) • Click ▶ 1P START or press Enter / 1`, 'success');
    }

    pressStart() {
        if (!this.gameStarted) {
            this.startGame();
            return;
        }

        if (window.arcadeSFX) {
            window.arcadeSFX.playStartSound();
        }

        // Direct C-level WASM injection into RetroArch/FBNeo core (Button 3 is 1P START!)
        let startSent = false;
        if (window.EJS_emulator && window.EJS_emulator.gameManager && typeof window.EJS_emulator.gameManager.simulateInput === 'function') {
            try {
                window.EJS_emulator.gameManager.simulateInput(0, 3, 1);
                setTimeout(() => {
                    try {
                        if (window.EJS_emulator && window.EJS_emulator.gameManager) {
                            window.EJS_emulator.gameManager.simulateInput(0, 3, 0);
                        }
                    } catch (_) {}
                }, 100);
                startSent = true;
            } catch (_) {}
        }

        // Also dispatch synthetic keys Enter and 1 as fallback
        if (!startSent && window.virtualArcadeControls) {
            window.virtualArcadeControls.press('start');
            setTimeout(() => window.virtualArcadeControls.release('start'), 100);
        }

        // Focus canvas so next keys (Left/Right, Attack) go to the game
        this.focusGameCanvas();

        // Reset pulsing state
        if (this.elements.btnStartP1) {
            this.elements.btnStartP1.classList.remove('ready-to-start');
        }
        if (this.elements.hudBtnStart) {
            this.elements.hudBtnStart.classList.remove('pulse');
        }

        this.showToast('🚀 1P START Triggered! Pick fighter (← / →) & press Attack (Z / J)!', 'success');
    }

    startGame() {
        if (this.gameStarted) return;
        this.gameStarted = true;

        this.downloadRomAndLaunch();
    }

    downloadRomAndLaunch() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', this.romUrl, true);
        xhr.responseType = 'blob';

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
                const blobUrl = URL.createObjectURL(xhr.response);
                this.launchEmulator(blobUrl);
            } else {
                console.warn('[DINO] Direct XHR status', xhr.status, 'launching with direct url');
                this.launchEmulator(this.romUrl);
            }
        };

        xhr.onerror = () => {
            console.warn('[DINO] XHR network error, launching with direct url');
            this.launchEmulator(this.romUrl);
        };

        xhr.send();
    }

    launchEmulator(romUrlOrBlob) {
        if (this.emulatorLoaded) return;
        this.emulatorLoaded = true;

        // Configure Cheats in EmulatorJS
        window.EJS_cheats = [
            ["🛡️ Immortal (Infinite Health)", "FFB2E1+64"],
            ["🔫 Unlimited Ammo (All Weapons)", "FFB6CE+63"]
        ];

        // Configure Default Controls for Arcade (Gamepads mapped to value2, keyboard handled exclusively at window level)
        window.EJS_defaultControls = {
            0: {
                0: { "value": "", "value2": "BUTTON_2" },  // B: Jump
                1: { "value": "", "value2": "BUTTON_4" },  // Y: Special
                2: { "value": "", "value2": "SELECT" },    // SELECT / COIN
                3: { "value": "", "value2": "START" },     // START
                4: { "value": "", "value2": "DPAD_UP" },
                5: { "value": "", "value2": "DPAD_DOWN" },
                6: { "value": "", "value2": "DPAD_LEFT" },
                7: { "value": "", "value2": "DPAD_RIGHT" },
                8: { "value": "", "value2": "BUTTON_1" }   // A: Attack
            },
            1: {},
            2: {},
            3: {}
        };

        // Configure EmulatorJS globals
        window.EJS_player = '#game-viewport';
        window.EJS_core = 'arcade';
        window.EJS_gameName = 'dino.zip';
        window.EJS_color = '#e11d48';
        // Use EmulatorJS native controls with only a joystick and X / Y buttons.
        window.EJS_VirtualGamepadSettings = [
            {
                type: 'zone', location: 'left', left: '50%', top: '50%',
                joystickInput: false, inputValues: [4, 5, 6, 7], color: 'blue'
            },
            {
                type: 'button', text: 'X', id: 'x', location: 'right',
                left: 10, top: 50, bold: true, input_value: 8
            },
            {
                type: 'button', text: 'Y', id: 'y', location: 'right',
                left: 80, top: 10, bold: true, input_value: 0
            }
        ];
        window.EJS_startOnLoaded = true;
        window.EJS_DEBUG_XX = true; // Bypass broken HEAD request cache check
        window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
        window.EJS_gameUrl = romUrlOrBlob;
        window.EJS_fullscreenOnLoaded = false;
        window.EJS_volume = 0.9;

        // Callbacks
        window.EJS_onGameStart = () => {
            console.log('[DINO] Game loop started at 60 FPS');
            this.dismissStartOverlay();
        };

        window.EJS_onLoadState = () => this.showToast('💾 State Loaded Successfully', 'info');
        window.EJS_onSaveState = () => this.showToast('💾 State Saved Successfully', 'info');

        // Watch for canvas mounting to instantly dismiss front card overlay
        this.setupEmulatorProgressWatcher();

        // Dynamically load EmulatorJS loader script
        const script = document.createElement('script');
        script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
        script.async = true;
        document.body.appendChild(script);
    }

    setupEmulatorProgressWatcher() {
        const viewport = this.elements.gameViewport;
        if (!viewport) return;

        const checkReady = () => {
            const canvas = viewport.querySelector('canvas');
            if ((canvas || (window.EJS_emulator && window.EJS_emulator.started)) && !this.gameReadyDismissed) {
                this.dismissStartOverlay();
            }
        };

        try {
            this.progressObserver = new MutationObserver(checkReady);
            this.progressObserver.observe(viewport, { childList: true, subtree: true });
        } catch (_) {}

        this.startupCheckInterval = setInterval(checkReady, 80);
    }

    dismissStartOverlay() {
        if (this.gameReadyDismissed) return;
        this.gameReadyDismissed = true;

        if (this.startupCheckInterval) {
            clearInterval(this.startupCheckInterval);
            this.startupCheckInterval = null;
        }
        if (this.progressObserver) {
            this.progressObserver.disconnect();
            this.progressObserver = null;
        }

        if (this.elements.liveHud) {
            this.elements.liveHud.classList.remove('hidden');
        }
        this.focusGameCanvas();
        this.applyActiveCheats();
        this.showToast('🦖 Cadillacs & Dinosaurs Ready! Press 🪙 Coin (5) then ▶ 1P Start (1 / Enter)', 'success');
    }

    initRamBaseDetector() {
        // Intercept console messages and Module.print to dynamically capture RetroArch's Cheevos System RAM address
        window.CPS1_RAM_BASE = window.CPS1_RAM_BASE || 0x68f1178;

        const checkText = (text) => {
            const m = String(text).match(/System RAM set to 0x([0-9a-fA-F]+)/i);
            if (m) {
                window.CPS1_RAM_BASE = parseInt(m[1], 16);
                console.log('[DINO] Dynamically mapped CPS-1 System RAM at 0x' + window.CPS1_RAM_BASE.toString(16));
            }
        };

        const origLog = console.log;
        console.log = function(...args) {
            origLog.apply(console, args);
            checkText(args.join(' '));
        };
    }

    getRamBase() {
        if (window.CPS1_RAM_BASE) return window.CPS1_RAM_BASE;
        const mod = window.EJS_emulator?.Module;
        if (!mod || !mod.HEAPU8) return null;
        // Known default FBNeo Emscripten base for 68000 Work RAM
        const defaultBase = 0x68f1178;
        if (defaultBase + 0xFFFF < mod.HEAPU8.length) {
            window.CPS1_RAM_BASE = defaultBase;
            return defaultBase;
        }
        return null;
    }

    applyImmortalCheat(heap, base) {
        // Player 1 Health (0xFFB2E0): Lock to 100 HP (0x64 full health bar)
        heap[base + 0xB2E0] = 0x64;
        // Player 1 Lives (0xFFB297): Lock to 9 lives
        heap[base + 0xB297] = 0x09;

        // Only protect Player 2 / Player 3 if they have actively joined (health > 0)
        if (heap[base + 0xB4E0] > 0) {
            heap[base + 0xB4E0] = 0x64;
            heap[base + 0xB497] = 0x09;
        }
        if (heap[base + 0xB6E0] > 0) {
            heap[base + 0xB6E0] = 0x64;
            heap[base + 0xB697] = 0x09;
        }
    }

    getRomBase(heap) {
        if (this._romBase && this._romBase + 0x180000 <= heap.length) {
            return this._romBase;
        }
        const defaultBase = 0x6450ce0;
        const sig = [0xff, 0x00, 0x66, 0x0e, 0x00, 0x00, 0x1a, 0x04];
        if (defaultBase + 8 < heap.length) {
            let match = true;
            for (let j = 0; j < 8; j++) {
                if (heap[defaultBase + j] !== sig[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                this._romBase = defaultBase;
                return defaultBase;
            }
        }

        // Scan in 68000 ROM range (0x6000000 - 0x7000000)
        const start = Math.max(0, 0x6000000);
        const end = Math.min(heap.length - 8, 0x7000000);
        for (let i = start; i < end; i += 2) {
            if (heap[i] === sig[0] && heap[i + 1] === sig[1] &&
                heap[i + 2] === sig[2] && heap[i + 3] === sig[3] &&
                heap[i + 4] === sig[4] && heap[i + 5] === sig[5] &&
                heap[i + 6] === sig[6] && heap[i + 7] === sig[7]) {
                this._romBase = i;
                return i;
            }
        }
        return null;
    }

    setUnlimitedAmmo(enabled) {
        const mod = window.EJS_emulator?.Module;
        if (!mod || !mod.HEAPU8) return;
        const heap = mod.HEAPU8;
        const romBase = this.getRomBase(heap);
        if (romBase === null) return;

        // All 68000 firearm bullet decrement offsets in ROM (A3 and A6 entity pointers):
        // Single-shot (Pistol/Rifle/Bazooka), Automatic (Uzi/M-16), Shotgun (SUBQ #8), Burst fire
        const a3Offsets = [
            0x10788, 0x10A5E, 0x10D92, 0x10EFE, 0x10F10, 0x110DE, 0x111D6,
            0x1142A, 0x1150C, 0x116D2, 0x11806, 0x11912, 0x11A44, 0x11BCA,
            0x11DEA, 0x11F20, 0x11FF8, 0x121A4, 0x1227A, 0x123E4, 0x124F6,
            0x1256A, 0x1262E, 0x126D2
        ];
        const a6Offsets = [
            0x18ED6, 0x25212, 0x252FE, 0x2556A, 0x256D0, 0x257DE, 0x25902
        ];

        if (!this._origAmmoOpcodes) {
            this._origAmmoOpcodes = {};
        }

        if (enabled) {
            // 1. Safe ASM Subroutine in unused ROM padding (0x1370C):
            // 366A 00B4: MOVE.W $00B4(A2), D3
            // 7063:      MOVEQ #$63, D0        (99 bullets)
            // 3740 006C: MOVE.W D0, $006C(A3)  (Writes 99 directly into weapon ammo in RAM)
            // 4E75:      RTS
            // Byte-swapped for 16-bit WASM: 6a 36 b4 00 63 70 40 37 6c 00 75 4e
            const subBytes = [0x6a, 0x36, 0xb4, 0x00, 0x63, 0x70, 0x40, 0x37, 0x6c, 0x00, 0x75, 0x4e];
            for (let i = 0; i < subBytes.length; i++) {
                heap[romBase + 0x1370c + i] = subBytes[i];
            }

            // 2. Hook at 0x0239DE:
            // 4EB9 0001 370C: JSR $01370C
            // 4E71:           NOP
            // Byte-swapped for 16-bit WASM: b9 4e 01 00 0c 37 71 4e
            const hookBytes = [0xb9, 0x4e, 0x01, 0x00, 0x0c, 0x37, 0x71, 0x4e];
            for (let i = 0; i < hookBytes.length; i++) {
                heap[romBase + 0x239de + i] = hookBytes[i];
            }

            // 3. Patch all weapon fire decrement instructions in-place to TST.W:
            // Tests $006C without decrementing. The following BGT branch always executes,
            // and the weapon never empties or gets discarded!
            for (const off of a3Offsets) {
                const addr = romBase + off;
                if (!this._origAmmoOpcodes[off]) {
                    this._origAmmoOpcodes[off] = [heap[addr], heap[addr + 1], heap[addr + 2], heap[addr + 3]];
                }
                heap[addr] = 0x6b;
                heap[addr + 1] = 0x4a;
                heap[addr + 2] = 0x6c;
                heap[addr + 3] = 0x00;
            }

            for (const off of a6Offsets) {
                const addr = romBase + off;
                if (!this._origAmmoOpcodes[off]) {
                    this._origAmmoOpcodes[off] = [heap[addr], heap[addr + 1], heap[addr + 2], heap[addr + 3]];
                }
                heap[addr] = 0x6e;
                heap[addr + 1] = 0x4a;
                heap[addr + 2] = 0x6c;
                heap[addr + 3] = 0x00;
            }
        } else {
            // Restore original 8 bytes at 0x0239DE:
            // MOVE.W $00B4(A2), D3; MOVE.W $006C(A3), D0
            const origHook = [0x6a, 0x36, 0xb4, 0x00, 0x2b, 0x30, 0x6c, 0x00];
            for (let i = 0; i < origHook.length; i++) {
                heap[romBase + 0x239de + i] = origHook[i];
            }

            // Restore padding at 0x1370C
            for (let i = 0; i < 12; i++) {
                heap[romBase + 0x1370c + i] = 0x00;
            }

            // Restore all decrement opcodes
            for (const off of [...a3Offsets, ...a6Offsets]) {
                const orig = this._origAmmoOpcodes[off];
                if (orig) {
                    const addr = romBase + off;
                    heap[addr] = orig[0];
                    heap[addr + 1] = orig[1];
                    heap[addr + 2] = orig[2];
                    heap[addr + 3] = orig[3];
                }
            }
        }
    }

    toggleCheat(type) {
        if (window.arcadeSFX) window.arcadeSFX.playClick();

        if (type === 'immortal') {
            this.cheats.immortal = !this.cheats.immortal;
            const active = this.cheats.immortal;

            // Update UI buttons
            this.elements.btnCheatImmortal?.classList.toggle('active', active);
            this.elements.hudBtnCheatImmortal?.classList.toggle('active', active);
            if (this.elements.hudStatusImmortal) {
                this.elements.hudStatusImmortal.textContent = active ? 'ON' : 'OFF';
            }

            // Immediately poke health if active
            const mod = window.EJS_emulator?.Module;
            const base = this.getRamBase();
            if (mod && mod.HEAPU8 && base !== null && active) {
                this.applyImmortalCheat(mod.HEAPU8, base);
            }

            this.showToast(active ? '🛡️ Immortal Mode: ON (Infinite Health + 9 Lives)' : '🛡️ Immortal Mode: OFF', active ? 'success' : 'info');
        } else if (type === 'ammo') {
            this.cheats.ammo = !this.cheats.ammo;
            const active = this.cheats.ammo;

            // Update UI buttons
            this.elements.btnCheatAmmo?.classList.toggle('active', active);
            this.elements.hudBtnCheatAmmo?.classList.toggle('active', active);
            if (this.elements.hudStatusAmmo) {
                this.elements.hudStatusAmmo.textContent = active ? 'ON' : 'OFF';
            }

            // Apply/restore ASM cheat
            this.setUnlimitedAmmo(active);

            this.showToast(active ? '🔫 Unlimited Ammo: ON (All Guns Have Infinite 99 Ammo)' : '🔫 Unlimited Ammo: OFF', active ? 'success' : 'info');
        }

        this.startCheatKeeperLoop();
    }

    startCheatKeeperLoop() {
        if (this.cheatRunning) return;
        this.cheatRunning = true;

        const loop = () => {
            if (!this.cheats.immortal && !this.cheats.ammo) {
                this.cheatRunning = false;
                if (this.cheatRafId) {
                    cancelAnimationFrame(this.cheatRafId);
                    this.cheatRafId = null;
                }
                if (this.cheatInterval) {
                    clearInterval(this.cheatInterval);
                    this.cheatInterval = null;
                }
                return;
            }

            const mod = window.EJS_emulator?.Module;
            const base = this.getRamBase();
            if (mod && mod.HEAPU8) {
                if (this.cheats.immortal && base !== null) {
                    this.applyImmortalCheat(mod.HEAPU8, base);
                }
                if (this.cheats.ammo) {
                    this.setUnlimitedAmmo(true);
                }
            }

            this.cheatRafId = requestAnimationFrame(loop);
        };

        this.cheatRafId = requestAnimationFrame(loop);

        // Fallback interval (runs every 60ms) to preserve cheats if tab blurs
        if (!this.cheatInterval) {
            this.cheatInterval = setInterval(() => {
                if (!this.cheats.immortal && !this.cheats.ammo) {
                    clearInterval(this.cheatInterval);
                    this.cheatInterval = null;
                    return;
                }
                const mod = window.EJS_emulator?.Module;
                const base = this.getRamBase();
                if (mod && mod.HEAPU8) {
                    if (this.cheats.immortal && base !== null) {
                        this.applyImmortalCheat(mod.HEAPU8, base);
                    }
                    if (this.cheats.ammo) {
                        this.setUnlimitedAmmo(true);
                    }
                }
            }, 60);
        }
    }

    applyActiveCheats() {
        const mod = window.EJS_emulator?.Module;
        const base = this.getRamBase();
        if (mod && mod.HEAPU8) {
            if (this.cheats.immortal && base !== null) {
                this.applyImmortalCheat(mod.HEAPU8, base);
            }
            if (this.cheats.ammo) {
                this.setUnlimitedAmmo(true);
            }
        }
        if (this.cheats.immortal) {
            this.startCheatKeeperLoop();
        }
    }

    loadCustomROMFile(file) {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            alert('Please select a valid arcade ROM zip file (e.g. dino.zip)');
            return;
        }

        const blobUrl = URL.createObjectURL(file);
        this.romUrl = blobUrl;
        this.showToast(`📁 Loaded custom ROM: ${file.name}`, 'success');

        if (!this.gameStarted) {
            this.startGame();
        } else {
            // Reload page with custom ROM
            window.location.reload();
        }
    }

    setupDropZone() {
        const container = this.elements.viewportContainer || document.body;

        ['dragenter', 'dragover'].forEach(eventName => {
            container.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                container.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                container.classList.remove('drag-over');
            }, false);
        });

        container.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                this.loadCustomROMFile(files[0]);
            }
        });
    }

    setLoadingProgress(percent, message) {
        if (this.elements.loadingProgress) {
            this.elements.loadingProgress.style.width = `${percent}%`;
        }
        if (this.elements.loadingText && message) {
            this.elements.loadingText.textContent = message;
        }
    }

    toggleFullscreen() {
        if (window.arcadeSFX) window.arcadeSFX.playClick();

        if (!document.fullscreenElement) {
            const el = document.documentElement;
            if (el.requestFullscreen) {
                el.requestFullscreen();
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            }
            this.showToast('🖥️ Fullscreen Mode Activated');
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            this.showToast('🖥️ Fullscreen Exited');
        }
    }

    toggleCRT() {
        this.crtEnabled = !this.crtEnabled;
        if (window.arcadeSFX) window.arcadeSFX.playCrtToggle();

        if (this.elements.crtOverlay) {
            this.elements.crtOverlay.classList.toggle('crt-active', this.crtEnabled);
        }
        if (this.elements.btnCrt) {
            this.elements.btnCrt.classList.toggle('active', this.crtEnabled);
        }

        this.showToast(this.crtEnabled ? '📺 CRT Scanlines: ON' : '📺 CRT Scanlines: OFF');
    }

    toggleViewMode() {
        if (window.arcadeSFX) window.arcadeSFX.playClick();
        const nextMode = this.viewMode === 'fullscreen' ? 'cabinet' : 'fullscreen';
        this.setViewMode(nextMode);
    }

    setViewMode(mode) {
        this.viewMode = mode;
        const container = this.elements.viewportContainer;
        if (!container) return;

        if (mode === 'cabinet') {
            container.classList.add('cabinet-mode');
            container.classList.remove('edge-to-edge');
            if (this.elements.btnViewMode) {
                this.elements.btnViewMode.innerHTML = '<span class="btn-icon">📺</span><span class="btn-text">Cabinet</span>';
            }
            this.showToast('🕹️ View Mode: Arcade Cabinet');
        } else {
            container.classList.remove('cabinet-mode');
            container.classList.add('edge-to-edge');
            if (this.elements.btnViewMode) {
                this.elements.btnViewMode.innerHTML = '<span class="btn-icon">⚡</span><span class="btn-text">Pure Full</span>';
            }
            this.showToast('⚡ View Mode: Edge-to-Edge');
        }
    }

    toggleMute() {
        const isMuted = !window.arcadeSFX.muted;
        window.arcadeSFX.setMuted(isMuted);

        if (this.elements.btnMute) {
            this.elements.btnMute.innerHTML = isMuted
                ? '<span class="btn-icon">🔇</span><span class="btn-text">Unmute</span>'
                : '<span class="btn-icon">🔊</span><span class="btn-text">Mute</span>';
            this.elements.btnMute.classList.toggle('active', !isMuted);
        }

        this.showToast(isMuted ? '🔇 Audio Muted' : '🔊 Audio Unmuted');
    }

    renderCharacterModal() {
        const listContainer = document.getElementById('character-cards-list');
        if (!listContainer || !window.ARCADE_CHARACTERS) return;

        listContainer.innerHTML = window.ARCADE_CHARACTERS.map(char => `
            <div class="character-card" style="--char-color: ${char.color}">
                <div class="char-header">
                    <span class="char-avatar">${char.avatar}</span>
                    <div class="char-title-group">
                        <h3 class="char-name">${char.name}</h3>
                        <span class="char-alias">${char.alias}</span>
                    </div>
                </div>
                <blockquote class="char-quote">"${char.quote}"</blockquote>
                <p class="char-desc">${char.description}</p>
                <div class="char-stats">
                    <div class="stat-bar-group">
                        <span class="stat-name">SPD</span>
                        <div class="stat-track"><div class="stat-fill" style="width: ${char.stats.speed * 20}%"></div></div>
                    </div>
                    <div class="stat-bar-group">
                        <span class="stat-name">PWR</span>
                        <div class="stat-track"><div class="stat-fill" style="width: ${char.stats.power * 20}%"></div></div>
                    </div>
                    <div class="stat-bar-group">
                        <span class="stat-name">DEF</span>
                        <div class="stat-track"><div class="stat-fill" style="width: ${char.stats.defense * 20}%"></div></div>
                    </div>
                </div>
                <div class="char-moves-list">
                    <h4>Signature Moves</h4>
                    ${char.signatureMoves.map(m => `
                        <div class="move-item">
                            <div class="move-name-row">
                                <span class="move-name">${m.name}</span>
                                <span class="move-input">${m.input}</span>
                            </div>
                            <span class="move-desc">${m.description}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Weapons container
        const weaponList = document.getElementById('weapons-list');
        if (weaponList && window.ARCADE_WEAPONS) {
            weaponList.innerHTML = window.ARCADE_WEAPONS.map(w => `
                <div class="weapon-card">
                    <span class="weapon-icon">${w.icon}</span>
                    <div class="weapon-info">
                        <h5>${w.name}</h5>
                        <p>${w.desc}</p>
                    </div>
                </div>
            `).join('');
        }
    }

    showToast(message, type = 'info') {
        if (window.arcadeGamepad) {
            window.arcadeGamepad.showToast(message, type);
        }
    }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.dinoApp = new DinoArcadeApp();
    window.dinoApp.init();
});
