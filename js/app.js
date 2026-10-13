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
            loadingProgress: document.getElementById('loading-progress-bar'),
            btnStart: document.getElementById('btn-start-game'),
            btnInsertCoin: document.getElementById('btn-insert-coin'),
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
        // Start Game
        this.elements.btnStart?.addEventListener('click', () => {
            this.startGame();
        });

        // Insert Coin
        this.elements.btnInsertCoin?.addEventListener('click', () => {
            this.insertCoin();
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

            if (e.key === '5' || e.key === 'c' || e.key === 'C') {
                // Insert Coin
                this.insertCoin();
            } else if (e.key === 'f' || e.key === 'F') {
                if (!e.ctrlKey && !e.metaKey) {
                    this.toggleFullscreen();
                }
            } else if (e.key === 'Escape') {
                document.querySelectorAll('.arcade-modal').forEach(m => m.classList.remove('open'));
            }
        });
    }

    insertCoin() {
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
            setTimeout(() => this.elements.btnInsertCoin.classList.remove('coin-inserted'), 300);
        }

        // If game is running, dispatch arcade coin key to emulator
        if (this.gameStarted && window.virtualArcadeControls) {
            window.virtualArcadeControls.press('coin');
            setTimeout(() => window.virtualArcadeControls.release('coin'), 120);
        } else if (!this.gameStarted) {
            this.showToast(`🪙 Coin Inserted! (${this.credits} Credit${this.credits > 1 ? 's' : ''}) - Tap START GAME`, 'success');
        }
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

        this.setLoadingProgress(15, 'Preparing WebAssembly Arcade Engine (FBNeo)...');
        this.loadEmulator();
    }

    loadEmulator() {
        if (this.emulatorLoaded) return;
        this.emulatorLoaded = true;

        this.setLoadingProgress(35, 'Fetching Capcom CPS-1.5 ROM (dino.zip)...');

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
            this.setLoadingProgress(100, 'Game Ready!');
            setTimeout(() => {
                if (this.elements.loadingOverlay) {
                    this.elements.loadingOverlay.classList.add('hidden');
                }
                this.showToast('🦖 Cadillacs & Dinosaurs Running at 60 FPS! Press 5 to Insert Coin, 1 to Start', 'success');
            }, 400);
        };

        window.EJS_onLoadState = () => this.showToast('💾 State Loaded Successfully', 'info');
        window.EJS_onSaveState = () => this.showToast('💾 State Saved Successfully', 'info');

        // Dynamically load EmulatorJS loader script
        const script = document.createElement('script');
        script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
        script.async = true;

        script.onload = () => {
            this.setLoadingProgress(60, 'Initializing Virtual System & Video Buffer...');
        };

        script.onerror = () => {
            console.warn('[DINO] Primary CDN failed, attempting fallback...');
            this.setLoadingProgress(70, 'Connecting to fallback mirror...');
            window.EJS_gameUrl = this.fallbackRomUrl;
            this.showToast('Retrying with backup ROM mirror...', 'warn');
        };

        document.body.appendChild(script);
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
