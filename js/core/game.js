import { AssetLoader } from './assetLoader.js';
import { World } from '../world/world.js';
import { Player } from '../entities/player.js';
import { Input } from './input.js';
import { CombatManager } from '../combat/combatManager.js';

export const Game = {
    canvas: null,
    ctx: null,
    state: 'BOOT',
    lastTime: 0,

    world: null,
    player: null,

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        window.addEventListener('resize', () => this.resize());
        this.resize();

        Input.init();

        this.bindGlobalEvents();

        window.addEventListener('combat-encounter', (e) => {
            if (this.state === 'PLAYING') {
                CombatManager.startCombat(this.player, e.detail.enemy);
            }
        });

        this.switchState('MENU');

        requestAnimationFrame((t) => this.loop(t));
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.imageRendering = 'pixelated';
    },

    switchState(newState) {
        this.state = newState;

        document.querySelectorAll('.screen').forEach(el => {
            el.classList.remove('active');
            el.classList.add('hidden');
        });

        switch (newState) {
            case 'MENU':
                this.showScreen('screen-main-menu');
                break;
            case 'CHAR_SELECT':
                this.showScreen('screen-character-select');
                break;
            case 'PLAYING':
            case 'COMBAT':
                this.showScreen('screen-game');
                break;
            case 'GAMEOVER':
                this.showScreen('overlay-gameover');
                break;
        }
    },

    bindGlobalEvents() {
        document.getElementById('btn-return-menu').addEventListener('click', () => {
            this.switchState('MENU');
        });
    },

    showScreen(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('hidden');
            el.classList.add('active');
        }
    },

    startRun(selectedClass) {
        this.world = new World();
        this.world.generate();

        const start = this.world.level.startPoint;
        this.player = new Player(start.x, start.y, selectedClass);

        import('../data/talents.js').then(m => {
            if (m.Talents[selectedClass]) {
                this.player.talents = JSON.parse(JSON.stringify(m.Talents[selectedClass]));
                this.player.recalcStats();
                // Also update UI ref?
                import('../ui/talentTreeUI.js').then(ui => {
                    ui.TalentTreeUI.setTalents(this.player.talents, this.player);
                });
            }
        });

        this.switchState('PLAYING');
    },

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (this.state === 'PLAYING' || this.state === 'COMBAT') {
            this.update(dt);
            this.draw();
        }

        Input.update();

        requestAnimationFrame((t) => this.loop(t));
    },

    update(dt) {
        if (this.player && this.world && this.state === 'PLAYING') {
            this.player.update(dt, this.world.level);
            this.world.update(dt, this.player);
        }

        // Update Floating Texts
        if (this.floatingTexts) {
            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                const ft = this.floatingTexts[i];
                ft.life -= dt;
                ft.y -= 10 * dt; // Float up
                if (ft.life <= 0) {
                    this.floatingTexts.splice(i, 1);
                }
            }
        }
    },

    draw() {
        this.ctx.fillStyle = '#0d0f1b';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.world) {
            this.world.draw(this.ctx, AssetLoader);
        }

        if (this.player) {
            this.player.draw(this.ctx, AssetLoader, this.world.camera);
        }

        // Draw Floating Texts
        if (this.floatingTexts) {
            this.ctx.font = '20px "Press Start 2P"';
            this.ctx.textAlign = 'center';
            for (const ft of this.floatingTexts) {
                // Adjust for camera
                const screenX = ft.x - this.world.camera.x + 32; // Center on tile
                const screenY = ft.y - this.world.camera.y;

                this.ctx.fillStyle = 'black';
                this.ctx.fillText(ft.text, screenX + 2, screenY + 2); // Shadow
                this.ctx.fillStyle = ft.color;
                this.ctx.fillText(ft.text, screenX, screenY);
            }
        }
    }
};
