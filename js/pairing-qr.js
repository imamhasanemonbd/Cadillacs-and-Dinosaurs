/** Local QR generation/decoding; no camera images or codes are uploaded. */
(() => {
    const encode = async code => {
        if (!window.CompressionStream) return code;
        try {
            const compact = code.startsWith('DINO1.') ? atob(code.slice(6)) : code;
            const data = await new Response(new Blob([compact]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
            return 'DINOQR2.' + btoa(String.fromCharCode(...new Uint8Array(data)));
        } catch (_) { return code; }
    };
    const decode = async payload => {
        if (payload.startsWith('DINO1.') && payload.length <= 65536) return payload;
        if ((!payload.startsWith('DINOQR1.') && !payload.startsWith('DINOQR2.')) || payload.length > 65536) throw new Error('This is not a Dino pairing QR. Scan the other player’s QR.');
        if (!window.DecompressionStream) throw new Error('This browser cannot read compressed pairing QR codes. Use copy/paste instead.');
        let bytes;
        try { bytes = Uint8Array.from(atob(payload.slice(8)), value => value.charCodeAt(0)); }
        catch (_) { throw new Error('The QR code is damaged. Show it again or use copy/paste.'); }
        const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
        const chunks = []; let length = 0;
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                length += value.length;
                if (length > 65536) { await reader.cancel(); throw new Error('Pairing QR is too large.'); }
                chunks.push(value);
            }
            const text = await new Blob(chunks).text();
            const code = payload.startsWith('DINOQR2.') ? 'DINO1.' + btoa(text) : text;
            if (!code.startsWith('DINO1.')) throw new Error('Invalid pairing QR.');
            return code;
        } catch (_) { throw new Error('The QR code is invalid. Show it again or use copy/paste.'); }
    };
    window.DinoQrCodec = { encode, decode };
    let libraries;
    const load = () => {
        if (!libraries) libraries = Promise.all(['qrcode.js', 'jsQR.js'].map(file => new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = new URL('js/vendor/' + file, document.baseURI).href;
            script.onload = resolve;
            script.onerror = () => { script.remove(); reject(new Error('QR tools could not load. Use copy/paste or try again.')); };
            document.head.appendChild(script);
        }))).catch(error => { libraries = null; throw error; });
        return libraries;
    };
    window.setupPairingQr = (dialog, say, onCode) => {
        const box = dialog.querySelector('.pairing-qr-display');
        const image = box.querySelector('.pairing-qr-image');
        const camera = dialog.querySelector('.pairing-qr-camera');
        const video = camera.querySelector('video');
        const preview = camera.querySelector('.pairing-camera-viewport');
        const mobile = document.documentElement.classList.contains('mobile-game-content');
        // Camera pixels are already oriented by the browser. Cancel the outer
        // game's rotation rather than guessing from the camera aspect ratio.
        const fitPreview = () => {
            if (!mobile || !preview) return;
            preview.style.setProperty('--preview-width', `${preview.clientWidth}px`);
            preview.style.setProperty('--preview-height', `${preview.clientHeight}px`);
            const rotation = Number(window.frameElement?.dataset.gameRotation) || 0;
            preview.style.setProperty('--camera-rotation', `${-rotation}deg`);
            preview.classList.toggle('rotated-camera', Math.abs(rotation) % 180 === 90);
            preview.classList.toggle('portrait-camera', video.videoHeight > video.videoWidth);
        };
        window.addEventListener('dino-frame-rotation', fitPreview);
        video.addEventListener('loadedmetadata', fitPreview);
        video.addEventListener('resize', fitPreview);
        if (mobile && preview && window.ResizeObserver) new ResizeObserver(fitPreview).observe(preview);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        let stream = null, frame = null, generation = 0, renderGeneration = 0, qrModules = 0;
        const fitQr = () => {
            if (!qrModules || box.hidden) return;
            const available = Math.min(420, box.clientWidth, innerHeight - 70);
            const ratio = window.devicePixelRatio || 1;
            const pixelsPerModule = Math.max(1, Math.floor(available * ratio / qrModules));
            image.style.width = `${pixelsPerModule * qrModules / ratio}px`;
        };
        window.addEventListener('resize', fitQr);
        const stop = () => {
            generation++;
            if (frame !== null) cancelAnimationFrame(frame);
            frame = null;
            stream?.getTracks().forEach(track => track.stop()); stream = null;
            video.pause(); video.srcObject = null; camera.hidden = true;
            canvas.width = canvas.height = 0;
        };
        const show = async code => {
            if (!code) throw new Error('Create or join a game first to generate your QR.');
            const current = ++renderGeneration;
            await load();
            const payload = await encode(code);
            if (current !== renderGeneration || !dialog.open) return;
            const qr = window.qrcode(0, 'M'); qr.addData(payload, 'Byte');
            try { qr.make(); } catch (_) { throw new Error('This connection is too large for one QR. Use copy/paste instead.'); }
            image.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
            image.querySelector('svg')?.setAttribute('shape-rendering', 'crispEdges');
            if (document.activeElement?.matches('textarea, input')) document.activeElement.blur();
            qrModules = qr.getModuleCount() + 8;
            box.hidden = false; fitQr();
            box.scrollIntoView({ block: 'nearest' });
        };
        const scan = async () => {
            stop();
            box.hidden = true;
            const current = generation;
            if (!navigator.mediaDevices?.getUserMedia) throw new Error('No camera access in this browser. Use copy/paste instead.');
            if (document.activeElement?.matches('textarea, input')) document.activeElement.blur();
            say('Allow camera access, then point it at the other player’s QR.');
            await load();
            if (current !== generation || !dialog.open) return;
            let media;
            try { media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 24, max: 30 }, ...(mobile ? { aspectRatio: { ideal: 16 / 9 } } : {}) }, audio: false }); }
            catch (error) {
                if (current !== generation) return;
                if (error.name === 'NotAllowedError' || error.name === 'SecurityError') throw new Error('Camera permission was denied. Allow it in browser settings, or use copy/paste.');
                throw new Error('No usable camera found. You can still pair with copy/paste.');
            }
            if (current !== generation || !dialog.open) { media.getTracks().forEach(track => track.stop()); return; }
            stream = media; video.srcObject = media; camera.hidden = false;
            const track = media.getVideoTracks()[0];
            try {
                if (track.getCapabilities?.().focusMode?.includes('continuous')) {
                    track.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(() => {});
                }
            } catch (_) {}
            try { await video.play(); } catch (_) { if (current !== generation) return; stop(); throw new Error('Camera preview could not start. Try scanning again or use copy/paste.'); }
            if (current !== generation) return;
            fitPreview();
            camera.scrollIntoView({ block: 'nearest' });
            say('Scanning locally. Hold the entire QR inside the camera view.');
            let lastScan = 0, scans = 0;
            const tick = now => {
                if (current !== generation) return;
                if (now - lastScan > 125 && video.readyState >= 2 && video.videoWidth) {
                    lastScan = now;
                    // Alternate a detailed center crop and the whole camera view.
                    // Full frames still find codes away from the center.
                    const crop = ++scans % 2 === 1;
                    const side = Math.min(video.videoWidth, video.videoHeight) * 0.9;
                    const sw = crop ? side : video.videoWidth, sh = crop ? side : video.videoHeight;
                    const scale = Math.min(1, (crop ? 960 : 1280) / Math.max(sw, sh));
                    const width = Math.round(sw * scale), height = Math.round(sh * scale);
                    if (canvas.width !== width) canvas.width = width;
                    if (canvas.height !== height) canvas.height = height;
                    context.drawImage(video, (video.videoWidth-sw)/2, (video.videoHeight-sh)/2, sw, sh, 0, 0, width, height);
                    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                    const result = window.jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
                    if (result) {
                        stop();
                        const decodedGeneration = generation;
                        decode(result.data).then(code => {
                            if (decodedGeneration !== generation || !dialog.open) return;
                            return onCode(code);
                        }).catch(error => { if (decodedGeneration === generation) say(error.message); });
                        return;
                    }
                }
                frame = requestAnimationFrame(tick);
            };
            frame = requestAnimationFrame(tick);
        };
        const clear = () => { stop(); renderGeneration++; image.replaceChildren(); box.hidden = true; };
        dialog.querySelector('[data-qr=stop]').addEventListener('click', () => { stop(); say('Camera stopped. You can scan again or use copy/paste.'); });
        dialog.addEventListener('close', stop);
        document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
        window.addEventListener('pagehide', stop);
        return { show, scan, stop, clear };
    };
})();
