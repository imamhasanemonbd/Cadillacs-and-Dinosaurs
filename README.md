# 🦖 Cadillacs and Dinosaurs — Web Arcade (60 FPS)

> Play Capcom's legendary 1993 arcade beat 'em up **Cadillacs and Dinosaurs** directly in any web browser, on any device, with zero installation.

[![60 FPS](https://img.shields.io/badge/Performance-60%20FPS-10b981?style=flat-square)](#)
[![WebAssembly](https://img.shields.io/badge/Engine-WebAssembly%20(FBNeo)-ff0055?style=flat-square)](#)
[![Mobile Ready](https://img.shields.io/badge/Mobile-Touch%20Controls%20%26%20Haptics-00f5d4?style=flat-square)](#)
[![Gamepad](https://img.shields.io/badge/Gamepad-Plug%20%26%20Play-ffb703?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

---

## 🌟 Highlights

* **Instant In-Browser Play**: Open the URL and immediately start brawling — no downloads, no desktop emulator installation.
* **Ultra Smooth 60 FPS**: Powered by an optimized WebAssembly build of **FinalBurn Neo (FBNeo)** with WebGL hardware-accelerated rendering and low-latency audio.
* **Universal Cross-Device Support**:
  * 📱 **Mobile & Tablets**: Floating 8-way virtual D-Pad, dedicated Attack, Jump, and **SP (A+B combo)** buttons with tactile haptic feedback.
  * 🖥️ **Desktop**: Low-latency keyboard mappings + Fullscreen toggle.
  * 🎮 **Physical Gamepads**: Automatic plug-and-play detection for Xbox, PlayStation DualSense, Nintendo Switch Pro, and 8BitDo controllers.
* **Retro Arcade Aesthetics**:
  * Authentic 1993 Capcom CPS-1.5 CRT monitor simulation with toggleable scanlines, phosphor glow, and curved bezel.
  * Synthesized Web Audio API "Insert Coin" chime and button sound effects.
  * Dual View Modes: **Edge-to-Edge Pure Fullscreen** or **Retro Arcade Cabinet Mode**.
* **Character Dossier & Move Guide**:
  * Built-in interactive move sheets and stat breakdowns for **Mustapha Cairo** (Flying Kick King), **Jack Tenrec**, **Hannah Dundee**, and **Mess O'Bradovich**.
  * Weapons guide (M16, Shotgun, UZI, Grenades, Bazooka, and the Stage 3 Cadillac).
* **Save / Load States**: Instant state persistence saved directly in your browser's IndexedDB.
* **Custom ROM Drag & Drop**: Play alternate CPS-1 / CPS-1.5 ROMs (e.g., hacks or other regional versions) simply by dragging `.zip` files onto the game window.

---

## 🕹️ Controls Guide

### ⌨️ Keyboard
| Action | Primary Key | Alternate Key |
| :--- | :--- | :--- |
| **Move Up / Down / Left / Right** | `W`, `S`, `A`, `D` | `Arrow Keys` |
| **Attack / Shoot / Pick Item** | `J` | `Z` |
| **Jump** | `K` | `X` |
| **Special 360 Whirlwind (A + B)** | `L` | `Spacebar` |
| **Insert Coin** | `5` | `C` |
| **1P Start** | `1` | `Enter` |
| **Toggle Fullscreen** | `F` | Button in Header |

### 🎮 Gamepad (Xbox / PlayStation / 8BitDo)
| Action | Xbox Controller | PlayStation Controller |
| :--- | :--- | :--- |
| **Movement** | D-Pad / Left Analog Stick | D-Pad / Left Analog Stick |
| **Attack** | Button `A` | Button `✕` |
| **Jump** | Button `B` | Button `○` |
| **Special (A + B)** | Button `X` / `Y` / `RB` | Button `□` / `△` / `R1` |
| **Insert Coin** | `View` / `Back` / `Share` | `Share` / `Select` |
| **1P Start** | `Menu` / `Start` | `Options` / `Start` |

### 📱 Touch Overlay (Mobile & Tablet)
* **Bottom Left**: 8-Way Virtual D-Pad (Up, Down, Left, Right, and Diagonals).
* **Bottom Right**:
  * **Button A (Red)**: Attack / Punch / Pick Weapon
  * **Button B (Blue)**: Jump
  * **Button SP (Gold)**: Special (A+B simultaneous super move)
* **Center Bottom**:
  * **🪙 COIN**: Inserts coin with authentic Capcom chime
  * **▶ 1P START**: Starts the game

---

## ⚡ Character Signature Moves

### ⚡ Mustapha Cairo (*The Speed & Kick King*)
* **Iconic Flying Kick**: Sprint (`→ →`) + Jump + Attack *(Massive crowd-clearing horizontal damage!)*
* **Somersault Flash Kick**: `↓ ↑ + Attack`
* **Tornado Spin Kick**: `Attack + Jump (A + B)` *(Emergency 360 escape)*

### 🔧 Jack Tenrec (*Balanced Hero*)
* **Slide Kick**: `↓ + Jump` *(Slides low under bullets and trips enemies)*
* **Dragon Uppercut**: `↓ ↑ + Attack`
* **Spinning Upper Blow**: `Attack + Jump (A + B)`

### 🗡️ Hannah Dundee (*Agile Weapon Master*)
* **Triangle Wall Spring**: Jump into screen border + Jump
* **Knife Mastery (Passive)**: Attack twice as fast with knives & bats
* **Spiral Cartwheel**: `Attack + Jump (A + B)`

### 💥 Mess O'Bradovich (*Heavy Colossus*)
* **Piledriver Slam**: Grab enemy + Jump + Attack
* **Flying Body Splash**: Sprint (`→ →`) + Jump + Attack
* **Meat Crusher**: `Attack + Jump (A + B)`

---

## 🚀 Quick Start (Local Development)

Clone the repository and run:

```bash
# Option 1: Node.js
npm start
# Server starts at http://localhost:3000

# Option 2: Python 3
python3 -m http.server 3000
# Open http://localhost:3000 in your browser
```

---

## 🌐 1-Click Deployment (Zero Backend Needed)

This project is 100% client-side static web code and can be hosted for free anywhere:

### Deploy on GitHub Pages
1. Push this repository to GitHub.
2. In your repo settings, go to **Pages** -> Source: **Deploy from a branch** -> Select `main` / `root`.
3. Save, and your live URL will be ready within 60 seconds!

### Deploy on Vercel
1. Install Vercel CLI: `npm i -g vercel` or import via the Vercel Web Dashboard.
2. Run `vercel` in this folder.
3. Done!

### Deploy on Netlify or Cloudflare Pages
* Simply drag and drop this project folder into [Netlify Drop](https://app.netlify.com/drop) or connect your repository on Cloudflare Pages.

---

## ⚙️ Architecture & Technical Stack

* **Hardware Core**: Emulates Capcom CPS-1.5 / CPS-Dash hardware (Motorola 68000 CPU @ 12 MHz, Z80 audio processor @ 4 MHz, Q-Sound stereo audio).
* **Emulation Engine**: WebAssembly port of FinalBurn Neo (FBNeo) via EmulatorJS.
* **Video Pipeline**: WebGL hardware-accelerated canvas with integer scaling and dynamic CRT scanline shader.
* **Audio Pipeline**: Web Audio API with low-latency stereo spatialization and real-time synthesized arcade coin effects.
* **Input Handling**: Multi-touch pointer events with `preventDefault` gesture isolation and HTML5 Gamepad API polling.

---

## 📜 Credits & Disclaimer

* *Cadillacs and Dinosaurs* is a registered trademark of Capcom Co., Ltd. (1993).
* Comics created by Mark Schultz (*Xenozoic Tales*).
* This project is an educational, open-source demonstration of modern WebAssembly emulation, Web Audio API, and cross-platform web capabilities.
* Licensed under the **MIT License**.


## Startup reliability

The game automatically starts after startup guards are installed for EmulatorJS 4.2.3. Failed or stalled cache validation falls back to downloading; interrupted core and ROM downloads retry once. Cache reads have a deadline. The core uses an empty in-memory save filesystem every visit, so startup never opens or waits for its old save database. Only the existing native Save State / Load State menu actions persist or restore progress. Optional font and language downloads do not block startup. After decompression, an inline status stays visible through core preparation, initialization, game-data loading and startup until the core frame counter advances. A frontend callback alone cannot dismiss it. If frames do not advance, the panel reports an engine stall rather than a network delay; WebGL context-loss events display a graphics interruption message without reloading. It retains real download percentages where available and uses a spinner plus elapsed time otherwise; a slow-step message appears after 15 seconds without a stage update.

The first visit still needs to download, decompress, and initialize the arcade WebAssembly core. Safari may require a real touch to enable audio; tapping any existing control resumes suspended audio without changing the game's pause state.

Install dependencies with `npm install`, then run regression checks with `npm test` (Node.js 20 or later).


### Manual saves and fresh startup

Every page load starts a fresh game. Automatic recovery, timed checkpoints, background saves and automatic restore are disabled. Older recovery checkpoints are ignored without deleting them. Use **Save State** and **Load State** in the existing emulator menu to save or restore progress explicitly; new installs default to saving in the browser. Existing manual save states and control layouts remain available.

Backgrounding pauses the current game and foregrounding resumes the same document without loading a save or navigating. If iOS discards the process, the next visit starts fresh until you choose Load State. Core decompression is followed by required WebAssembly initialization and ROM loading; there is no saved-game database wait.

For unexpected restarts, `window.dinoSessionDiagnostics` in the game iframe contains the preceding/current session, lifecycle events, runtime errors and sampled WebAssembly heap size. The bounded record is stored locally as `dino-session-diagnostics-v1`; it contains no game snapshot and nothing is uploaded. It can suggest an abrupt exit but cannot establish whether memory pressure or a browser crash caused it.


## Two-player Wi-Fi prototype (no paid server)

This experimental mode pairs two browsers using copy/paste codes and exchanges inputs directly using WebRTC data channels. It works with static GitHub Pages hosting. No camera, room server or WebSocket backend is required. A public Google STUN service helps discover connection paths; it does not relay gameplay. There is no TURN relay, so some routers, guest networks, hotspots and VPNs will not connect. Start testing on the same Wi-Fi.

### Test with Mac and iPhone

1. Open the updated site on both devices, join the same Wi-Fi, and wait for the game to load. Use the Mac as host for the first test. Keep cheats, rewind, fast-forward and slow motion off.
2. On the Mac, open **2P Connect → Create game (host)**. A QR appears automatically. You can redisplay it with **Show QR**.
3. On the iPhone, open **2P Connect → Scan QR**, allow camera access, and point the camera at the Mac’s QR. The guest joins automatically and displays a reply QR.
4. On the Mac, tap **Scan QR** and scan that reply from the iPhone. Pairing completes automatically; there is no need to press Join or Accept when scanning.
5. If the Mac has no camera, expand **Copy/paste instead (no camera)** on the iPhone, copy its reply, and send it to the Mac. Expand the same section on the Mac, paste the reply, and tap **Accept reply (host)**. You can also use copy/paste for the entire exchange.
6. When connected, close both panels with **×**. Mac controls Player 1; iPhone controls Player 2. Use **Coin → Start** on each device.

Both scans are necessary for serverless pairing. Codes expire after ten minutes and replies must match their host offer. QR codes are generated and decoded locally; camera images are not uploaded. The camera stops after detection, on Stop camera, when closing or leaving the popup, and when the app is backgrounded. Scanning needs HTTPS (GitHub Pages provides it) or localhost and camera permission. QR libraries are bundled in the repository and loaded only when needed. Compression makes the QR less dense on supported browsers; plain-code QR remains a fallback.

The top button shows network round-trip time (RTT), not total button-to-screen latency. Open it for **Resync (host)** or **Leave / cancel pairing**. Leaving restores solo controls without reloading the page.

The game keeps running while the connection panel is open and codes are exchanged. Closing the panel before a peer connects cancels pairing and leaves solo play running. Synchronization pauses start only when the direct connection opens. The host's current state is transferred to the guest. This is buffered frame lockstep, **not rollback netplay**: it adds three frames (about 50 ms at 60 FPS), and both devices wait when an input is missing. Backgrounding either device pauses shared progression. A disconnected session stays paused until you leave and pair again. There is no automatic page reload or multiplayer reconnect across an iOS process termination.

Both peers must use the same ROM, runtime and core settings. Cheats, native pause/settings/reset and independent save loads are locked while paired. Every 120 shared frames, the prototype compares the first 256 KiB of the tested 275,792-byte FBNeo save-state layout, covering frame metadata and a main/video RAM prefix. Device-dependent audio mixer history is excluded. This is a game-specific drift check, **not a full-core determinism guarantee**. Mismatches trigger bounded host-state resynchronization; repeated failure pauses the test instead of silently continuing apart. Three-player rooms and rollback are not implemented yet.

Physical iPhone/Safari and hotspot compatibility still need device testing. Browser tests cover two separate contexts using the real ROM/core, matching frame progression and RAM checks, both players' inputs, background pause/resume, manual resync, disconnect and solo cleanup.

### Browser regression

With Node.js 20 or later, after `npm install`, run `npx playwright install chromium`, start the site with `npm run serve:py`, then run `npm run test:browser`. The test downloads the pinned emulator assets and uses the actual game. Optional environment variables: `DINO_TEST_URL` for another local URL and `DINO_CHROME_PATH` for an installed Chrome executable. `npm run test:manual-browser` verifies that a new visit ignores both manual saves and old checkpoints, that no timed/background saves occur, and that native Save/Load restores progress only after explicit clicks. `npm run test:progress-browser` verifies visible post-decompression stages, elapsed/slow-step feedback and cleanup on the first running frame. `npm test` runs the network-independent startup, recovery and lockstep unit tests.


QR regressions: `npm run test:qr-browser` exercises camera-denial fallback, real QR decoding through a synthetic video stream, automatic two-scan connection, synchronized gameplay, and camera-track cleanup. Physical camera testing on iPhone/Mac remains necessary. `npm run vendor:qr` refreshes bundled source from the pinned npm packages; retain the accompanying license notices in `js/vendor/`.

### Mobile portrait and landscape

Portrait uses a handheld layout: the game fills the upper section and the existing native joystick, X/Y, Coin and Start controls sit below it. Turning the phone sideways fits the original 4:3 picture inside the landscape viewport with black side bars without reloading or rotating the camera. Portrait and landscape control layouts save separately; existing custom layouts remain the landscape layout. The Home Screen manifest allows both orientations. Browser-bar fullscreen still uses the existing fullscreen icon where supported; iPhone needs the Home Screen web app to hide Safari bars.
