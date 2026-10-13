/** Fullscreen controls live inside the game so the icon rotates with it. */
window.setupGameFullscreen = () => {
    const hostDocument = window.top.document;
    const root = hostDocument.documentElement;
    const standalone = navigator.standalone || window.top.matchMedia('(display-mode: standalone)').matches;
    // Home Screen apps already hide browser chrome; iOS provides their exit gesture.
    if (standalone) return;
    const button = document.createElement('button');
    button.id = 'game-fullscreen';
    button.type = 'button';
    const help = document.createElement('p');
    help.id = 'fullscreen-help';
    help.hidden = true;
    help.textContent = 'For a game without browser bars on iPhone: Safari → Share → Add to Home Screen → Open as Web App. Then open Dino Arcade from your Home Screen. Swipe Home to exit.';
    const update = () => {
        const active = !!(hostDocument.fullscreenElement || hostDocument.webkitFullscreenElement);
        button.textContent = active ? '×' : '⛶';
        button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
        button.title = active ? 'Exit fullscreen' : 'Enter fullscreen';
        button.classList.toggle('is-fullscreen', active);
    };
    button.addEventListener('click', async () => {
        try {
            if (hostDocument.fullscreenElement || hostDocument.webkitFullscreenElement) {
                const exit = hostDocument.exitFullscreen || hostDocument.webkitExitFullscreen;
                await exit.call(hostDocument);
            } else {
                const enter = root.requestFullscreen || root.webkitRequestFullscreen;
                if (!enter) { help.hidden = !help.hidden; return; }
                await enter.call(root);
                help.hidden = true;
            }
        } catch (_) {
            help.hidden = false;
        }
        update();
    });
    hostDocument.addEventListener('fullscreenchange', update);
    hostDocument.addEventListener('webkitfullscreenchange', update);
    document.body.append(button, help);
    update();
};
