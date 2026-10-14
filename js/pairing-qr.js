/** Local QR generation/decoding; no camera images or codes are uploaded. */
(() => {
    const encode = async code => {
        if (!window.CompressionStream) return code;
        try {
            const data = await new Response(new Blob([code]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
            return 'DINOQR1.' + btoa(String.fromCharCode(...new Uint8Array(data)));
        } catch (_) { return code; }
    };
    const decode = async payload => {
        if (payload.startsWith('DINO1.') && payload.length <= 65536) return payload;
        if (!payload.startsWith('DINOQR1.') || payload.length > 65536) throw new Error('This is not a Dino pairing QR. Scan the other player’s QR.');
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
            const code = await new Blob(chunks).text();
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
        // Safari may deliver portrait camera frames even inside our landscape
        // iframe. Normalize only the mobile preview; decode the original pixels.
        const fitPreview = () => {
            if (!mobile || !preview) return;
            preview.style.setProperty('--preview-width', `${preview.clientWidth}px`);
            preview.style.setProperty('--preview-height', `${preview.clientHeight}px`);
            preview.classList.toggle('portrait-camera', video.videoHeight > video.videoWidth);
        };
        video.addEventListener('loadedmetadata', fitPreview);
        video.addEventListener('resize', fitPreview);
        if (mobile && preview && window.ResizeObserver) new ResizeObserver(fitPreview).observe(preview);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        let stream = null, frame = null, generation = 0, renderGeneration = 0;
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
            if (document.activeElement?.matches('textarea, input')) document.activeElement.blur();
            box.hidden = false;
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
            try { media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, ...(mobile ? { aspectRatio: { ideal: 16 / 9 } } : {}) }, audio: false }); }
            catch (error) {
                if (current !== generation) return;
                if (error.name === 'NotAllowedError' || error.name === 'SecurityError') throw new Error('Camera permission was denied. Allow it in browser settings, or use copy/paste.');
                throw new Error('No usable camera found. You can still pair with copy/paste.');
            }
            if (current !== generation || !dialog.open) { media.getTracks().forEach(track => track.stop()); return; }
            stream = media; video.srcObject = media; camera.hidden = false;
            try { await video.play(); } catch (_) { if (current !== generation) return; stop(); throw new Error('Camera preview could not start. Try scanning again or use copy/paste.'); }
            if (current !== generation) return;
            fitPreview();
            camera.scrollIntoView({ block: 'nearest' });
            say('Scanning locally. Hold the entire QR inside the camera view.');
            let lastScan = 0;
            const tick = now => {
                if (current !== generation) return;
                if (now - lastScan > 200 && video.readyState >= 2 && video.videoWidth) {
                    lastScan = now;
                    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
                    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
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
