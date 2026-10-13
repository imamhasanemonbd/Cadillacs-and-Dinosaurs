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

        // Fast In-Game Cheats
        this.cheats = { immortal: false, ammo: false };
        this.cheatInterval = null;

        // Dynamic Loading synchronization
        this.progressObserver = null;
        this.startupCheckInterval = null;
        this.gameReadyDismissed = false;
        
        this.elements = {};
    }

    init() {
        this.cacheDOMElements();
        this.bindUIEvents();
        this.renderCharacterModal();
        this.setupDropZone();
        
        // Connect gamepad status indicator
        if (window.arcadeGamepad && this.elements.gamepadIndicator) {
            window.arcadeGamepad.setStatusElement(this.elements.gamepadIndicator);
        }

        // Initialize mobile touch controls
        if (window.virtualArcadeControls && this.elements.touchControls) {
            window.virtualArcadeControls.init(this.elements.touchControls);
        }

        // Keyboard hotkeys
        this.bindKeyboardShortcuts();

        // Check if device is mobile to auto-suggest full view
        if (window.innerWidth <= 768) {
            this.setViewMode('fullscreen');
        }
    }

    cacheDOMElements() {
        this.elements = {
            viewportContainer: document.getElementById('arcade-viewport-container'),
            gameViewport: document.getElementById('game-viewport'),
            startOverlay: document.getElementById('start-overlay'),
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingText: document.getElementById('loading-text'),
            loadingSubtext: document.getElementById('loading-subtext'),
            loadingProgress: document.getElementById('loading-progress-bar'),
            btnForceEnter: document.getElementById('btn-force-enter-game'),
            btnStart: document.getElementById('btn-start-game'),
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
        // Start Game from initial hero splash
        this.elements.btnStart?.addEventListener('click', () => {
            this.startGame();
        });

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
        window.addEventListener('keydown', (e) => {
            // Prevent interference if user is in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Coin keys: 5, c, C, v, V
            if (e.key === '5' || e.code === 'Digit5' || e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V') {
                this.insertCoin();
            } 
            // 1P Start keys: 1, Digit1, Enter
            else if (e.key === '1' || e.code === 'Digit1' || e.key === 'Enter') {
                this.pressStart();
            } 
            // Cheat shortcuts: G = God Mode / Immortal, U = Unlimited Ammo
            else if (e.key === 'g' || e.key === 'G') {
                this.toggleCheat('immortal');
            } 
            else if (e.key === 'u' || e.key === 'U') {
                this.toggleCheat('ammo');
            }
            else if (e.key === 'f' || e.key === 'F') {
                if (!e.ctrlKey && !e.metaKey) {
                    this.toggleFullscreen();
                }
            } else if (e.key === 'Escape') {
                document.querySelectorAll('.arcade-modal').forEach(m => m.classList.remove('open'));
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

        if (window.arcadeSFX) {
            window.arcadeSFX.init();
            window.arcadeSFX.playStartSound();
        }

        if (this.elements.startOverlay) {
            this.elements.startOverlay.classList.add('hidden');
        }
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('hidden');
        }

        this.setLoadingProgress(15, 'Preparing WebAssembly Arcade Engine (FBNeo)...', 'Loading emulator scripts');
        this.loadEmulator();
    }

    loadEmulator() {
        if (this.emulatorLoaded) return;
        this.emulatorLoaded = true;

        this.setLoadingProgress(25, 'Downloading Capcom CPS-1 Core (FBNeo)...', 'Connecting to high-speed CDN');

        // Configure Cheats in EmulatorJS
        window.EJS_cheats = [
            ["🛡️ Immortal (Infinite Health)", "FFB2E1+64"],
            ["🔫 Unlimited Ammo (All Weapons)", "FFB6CE+63"]
        ];

        // Configure Default Controls for Arcade
        window.EJS_defaultControls = {
            0: {
                0: { "value": "x", "value2": "BUTTON_2" },  // B: Jump
                1: { "value": "s", "value2": "BUTTON_4" },  // Y: Special
                2: { "value": "5", "value2": "SELECT" },    // SELECT / COIN: 5
                3: { "value": "1", "value2": "START" },     // START: 1
                4: { "value": "up arrow", "value2": "DPAD_UP" },
                5: { "value": "down arrow", "value2": "DPAD_DOWN" },
                6: { "value": "left arrow", "value2": "DPAD_LEFT" },
                7: { "value": "right arrow", "value2": "DPAD_RIGHT" },
                8: { "value": "z", "value2": "BUTTON_1" }   // A: Attack
            }
        };

        // Configure EmulatorJS globals
        window.EJS_player = '#game-viewport';
        window.EJS_core = 'arcade';
        window.EJS_gameName = 'Cadillacs and Dinosaurs (World 930201)';
        window.EJS_color = '#e11d48';
        window.EJS_startOnLoaded = true;
        window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
        window.EJS_gameUrl = this.romUrl;
        window.EJS_fullscreenOnLoaded = false;
        window.EJS_volume = 0.9;

        // Callbacks
        window.EJS_onGameStart = () => {
            console.log('[DINO] Game loop started at 60 FPS');
            this.dismissLoadingOverlay();
        };

        window.EJS_onLoadState = () => this.showToast('💾 State Loaded Successfully', 'info');
        window.EJS_onSaveState = () => this.showToast('💾 State Saved Successfully', 'info');

        // Start watching real-time EmulatorJS progress and canvas attachment
        this.setupEmulatorProgressWatcher();

        // Dynamically load EmulatorJS loader script
        const script = document.createElement('script');
        script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
        script.async = true;

        script.onload = () => {
            this.setLoadingProgress(40, 'Engine scripts loaded, compiling core...', 'Downloading 8.2MB FBNeo WASM binary');
        };

        script.onerror = () => {
            console.warn('[DINO] Primary CDN failed, attempting fallback...');
            this.setLoadingProgress(60, 'Connecting to fallback mirror...', 'Retrying ROM mirror');
            window.EJS_gameUrl = this.fallbackRomUrl;
            this.showToast('Retrying with backup ROM mirror...', 'warn');
        };

        document.body.appendChild(script);
    }

    setupEmulatorProgressWatcher() {
        const viewport = this.elements.gameViewport;
        if (!viewport) return;

        const checkProgress = () => {
            // Find EmulatorJS loading text (updates with "Download Game Core XX%", "Download Game Data XX%")
            const textElem = viewport.querySelector('.ejs_loading_text') || viewport.querySelector('[class*="loading"]');
            if (textElem && textElem.innerText) {
                const text = textElem.innerText.trim();
                if (text) {
                    let percent = 50;
                    const match = text.match(/(\d+)%/);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (text.toLowerCase().includes('core')) {
                            percent = Math.min(65, 30 + Math.round(num * 0.35));
                        } else {
                            percent = Math.min(95, 65 + Math.round(num * 0.3));
                        }
                    } else if (text.toLowerCase().includes('core')) {
                        percent = 45;
                    } else if (text.toLowerCase().includes('data') || text.toLowerCase().includes('rom')) {
                        percent = 78;
                    } else if (text.toLowerCase().includes('loading') || text.toLowerCase().includes('start')) {
                        percent = 92;
                    }
                    this.setLoadingProgress(percent, text, 'Downloading arcade assets...');
                }
            }

            // Check if canvas has started rendering or emulator started
            const canvas = viewport.querySelector('canvas');
            if ((canvas || (window.EJS_emulator && window.EJS_emulator.started)) && !this.gameReadyDismissed) {
                this.dismissLoadingOverlay();
            }
        };

        // Mutation Observer on game viewport
        try {
            this.progressObserver = new MutationObserver(checkProgress);
            this.progressObserver.observe(viewport, { childList: true, subtree: true, characterData: true });
        } catch (_) {}

        // Fallback polling interval
        this.startupCheckInterval = setInterval(checkProgress, 200);

        // After 4.5 seconds, reveal the force enter button in case audio policy or prompt is waiting
        setTimeout(() => {
            if (!this.gameReadyDismissed && this.elements.btnForceEnter) {
                this.elements.btnForceEnter.style.display = 'inline-flex';
                if (this.elements.loadingSubtext) {
                    this.elements.loadingSubtext.textContent = 'Engine ready! Tap below if video does not auto-enter.';
                }
            }
        }, 4500);
    }

    dismissLoadingOverlay() {
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

        this.setLoadingProgress(100, 'Game Ready!', 'Entering 60 FPS arcade screen...');
        setTimeout(() => {
            if (this.elements.loadingOverlay) {
                this.elements.loadingOverlay.classList.add('hidden');
            }
            if (this.elements.liveHud) {
                this.elements.liveHud.classList.remove('hidden');
            }
            this.focusGameCanvas();
            this.applyActiveCheats();
            this.showToast('🦖 Cadillacs & Dinosaurs Ready! Click 🪙 Coin (5) then ▶ 1P Start (1 / Enter)', 'success');
        }, 300);
    }

    forceEnterGame() {
        if (window.arcadeSFX) window.arcadeSFX.playStartSound();

        // Trigger EmulatorJS internal start button if waiting
        const ejsStartBtn = this.elements.gameViewport?.querySelector('.ejs_start_button, [class*="start"], button');
        if (ejsStartBtn) {
            try { ejsStartBtn.click(); } catch (_) {}
        }
        if (window.EJS_emulator && typeof window.EJS_emulator.startButtonClicked === 'function') {
            try { window.EJS_emulator.startButtonClicked(ejsStartBtn || {}); } catch (_) {}
        }

        this.dismissLoadingOverlay();
    }

    setLoadingProgress(percent, message, submessage) {
        if (this.elements.loadingProgress) {
            this.elements.loadingProgress.style.width = `${percent}%`;
        }
        if (this.elements.loadingText && message) {
            this.elements.loadingText.textContent = message;
        }
        if (this.elements.loadingSubtext && submessage) {
            this.elements.loadingSubtext.textContent = submessage;
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

            // Apply via RetroArch/FBNeo WASM Cheat Engine (0xFFB2E1 = 100 HP)
            this.applyCheatCode(0, active, 'FFB2E1+64');

            this.showToast(active ? '🛡️ Immortal Mode: ACTIVE (Player 1 Cannot Die)' : '🛡️ Immortal Mode: OFF', active ? 'success' : 'info');
        } else if (type === 'ammo') {
            this.cheats.ammo = !this.cheats.ammo;
            const active = this.cheats.ammo;

            // Update UI buttons
            this.elements.btnCheatAmmo?.classList.toggle('active', active);
            this.elements.hudBtnCheatAmmo?.classList.toggle('active', active);
            if (this.elements.hudStatusAmmo) {
                this.elements.hudStatusAmmo.textContent = active ? 'ON' : 'OFF';
            }

            // Apply via RetroArch/FBNeo WASM Cheat Engine (0xFFB6CE = 99 Bullets)
            this.applyCheatCode(1, active, 'FFB6CE+63');

            this.showToast(active ? '🔫 Unlimited Ammo: ACTIVE (All Weapons Have 99 Ammo)' : '🔫 Unlimited Ammo: OFF', active ? 'success' : 'info');
        }

        this.startCheatKeeperLoop();
    }

    applyCheatCode(index, enabled, code) {
        if (window.EJS_emulator && window.EJS_emulator.gameManager && typeof window.EJS_emulator.gameManager.setCheat === 'function') {
            try {
                window.EJS_emulator.gameManager.setCheat(index, enabled ? 1 : 0, code);
            } catch (_) {}
        }
    }

    startCheatKeeperLoop() {
        if (this.cheatInterval) return;

        // Reinforce cheat memory values during gameplay every 250ms
        this.cheatInterval = setInterval(() => {
            if (!this.cheats.immortal && !this.cheats.ammo) {
                clearInterval(this.cheatInterval);
                this.cheatInterval = null;
                return;
            }
            this.applyActiveCheats();
        }, 250);
    }

    applyActiveCheats() {
        if (this.cheats.immortal) {
            this.applyCheatCode(0, true, 'FFB2E1+64');
        }
        if (this.cheats.ammo) {
            this.applyCheatCode(1, true, 'FFB6CE+63');
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
