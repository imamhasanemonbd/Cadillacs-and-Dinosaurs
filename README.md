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

The game automatically starts after startup guards are installed for EmulatorJS 4.2.3. Failed or stalled cache validation falls back to downloading; interrupted core and ROM downloads retry once. Cache reads have a deadline, while saved games, save states, and control layouts are preserved. Optional font and language downloads do not block startup.

The first visit still needs to download, decompress, and initialize the arcade WebAssembly core. Safari may require a real touch to enable audio; tapping any existing control resumes suspended audio without changing the game's pause state.

Run startup regression checks with `npm test` (Node.js 18 or later).


### Home Screen session recovery

Backgrounding the app saves a checkpoint and pauses the game; foregrounding resumes it without navigation. A lightweight checkpoint is also saved every 15 seconds. If the operating system discards the app process, the next launch restores the latest checkpoint for the same ROM (up to 24 hours old). Reloading also restores this checkpoint; use **Restart** in the native emulator menu to start fresh. Existing manual save states and control layouts are unchanged.

Websites cannot prevent iOS from terminating their processes under memory pressure. Recovery can lose up to 15 seconds of progress if the process is killed without a background event, and requires available site storage. The mobile CRT compositing layer is disabled to reduce graphics overhead.
