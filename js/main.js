import { Game } from './core/game.js';
import { Auth } from './core/auth.js';
import { AssetLoader } from './core/assetLoader.js';

document.addEventListener('DOMContentLoaded', async () => {

    // UI References
    const btnLogin = document.getElementById('btn-login');
    const btnStart = document.getElementById('btn-start');
    const authStatus = document.getElementById('auth-status');
    const btnLaunch = document.getElementById('btn-launch-run');
    const btnBackMenu = document.getElementById('btn-back-menu');
    const classCards = document.querySelectorAll('.class-card');

    let selectedClass = null;

    // Check Auth State on Load
    function updateAuthUI() {
        if (Auth.isLoggedIn()) {
            const user = Auth.getUser();
            authStatus.textContent = `Welcome, ${user}`;
            authStatus.style.color = '#99e550';
            btnLogin.style.display = 'none'; // Hide login if logged in
            btnStart.disabled = false;
        } else {
            authStatus.textContent = 'Not logged in';
            authStatus.style.color = '#ac3232';
            btnLogin.style.display = 'block';
            btnStart.disabled = true;
        }
    }

    // Bind Events
    btnLogin.addEventListener('click', () => {
        Auth.login();
        updateAuthUI();
    });

    btnStart.addEventListener('click', () => {
        Game.switchState('CHAR_SELECT');
    });

    btnBackMenu.addEventListener('click', () => {
        Game.switchState('MENU');
    });

    classCards.forEach(card => {
        card.addEventListener('click', () => {
            // Deselect all
            classCards.forEach(c => c.classList.remove('selected'));
            // Select this
            card.classList.add('selected');
            selectedClass = card.dataset.class;
            btnLaunch.disabled = false;
        });
    });

    btnLaunch.addEventListener('click', () => {
        if (selectedClass) {
            Game.startRun(selectedClass);
        }
    });

    // Initialize Game
    try {
        console.log('Loading Assets...');
        await AssetLoader.loadAll();
        console.log('Assets Loaded.');

        Game.init();

        // Init UI Modules
        import('./ui/talentTreeUI.js').then(m => m.TalentTreeUI.init());
        import('./ui/inventoryUI.js').then(m => m.InventoryUI.init());

        updateAuthUI();

    } catch (e) {
        console.error("Game Setup Failed:", e);
        document.body.innerHTML = "<h1>Error loading game assets. Check console.</h1>";
    }
});
