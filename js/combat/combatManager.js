import { TurnManager } from './turnManager.js';
import { Game } from '../core/game.js';
import { Stats } from '../data/stats.js';
import { LootSystem } from '../core/lootSystem.js';

export const CombatManager = {
    turnManager: new TurnManager(),
    player: null,
    enemy: null,
    isActive: false,

    ui: {
        hudTop: document.getElementById('hud-top'),
        hudBottom: document.getElementById('hud-bottom'),
        turnIndicator: document.getElementById('turn-indicator'),
        actions: document.querySelectorAll('.action-btn'),
        hpBar: document.querySelector('#hp-bar span'),
        manaBar: document.querySelector('#mana-bar span')
    },

    startCombat(player, enemy) {
        this.player = player;
        this.enemy = enemy;
        this.isActive = true;

        this.ensureStats(player);
        this.ensureStats(enemy);

        Game.switchState('COMBAT');

        // Show Combat UI
        const actionBar = document.getElementById('action-bar');
        if (actionBar) actionBar.classList.remove('hidden');

        // Show Enemy HUD
        const enemyHud = document.getElementById('enemy-hud');
        if (enemyHud) enemyHud.classList.remove('hidden');

        // Update Enemy Name
        const enemyNameEl = document.getElementById('enemy-name');
        if (enemyNameEl) enemyNameEl.textContent = enemy.name || "Enemy";

        const overlay = document.getElementById('combat-overlay');
        const msg = document.getElementById('combat-message');
        if (overlay && msg) {
            msg.textContent = "FIGHT!";
            overlay.classList.remove('hidden');
            // Reset animation
            overlay.style.animation = 'none';
            overlay.offsetHeight;
            overlay.style.animation = null;
        }

        const skillBtnLabel = document.getElementById('btn-skill-label');
        if (skillBtnLabel) {
            const cls = player.charClass || 'warrior';
            let txt = "Skill";
            if (cls === 'warrior') txt = "H.Strike\n10 MP";
            if (cls === 'mage') txt = "Fireball\n10 MP";
            if (cls === 'rogue') txt = "Crit\n10 MP";
            skillBtnLabel.innerText = txt;
        }

        player.name = "Hero";

        this.turnManager.startCombat([player, enemy]);

        this.updateUI();
        this.processTurn();
        this.bindActions();
    },

    ensureStats(entity) {
        if (!entity.stats.derived) {
            if (!entity.attributes) {
                entity.attributes = { str: 10, dex: 10, con: 12, int: 8, wis: 8, cha: 8 };
            }
            entity.stats.derived = Stats.calculate(entity.attributes, 1);
            entity.currentHp = entity.stats.derived.maxHp;
            entity.currentMana = entity.stats.derived.maxMana;
        }
    },

    bindActions() {
        this.ui.actions.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const key = target.dataset.key;
                this.handlePlayerAction(key);
            });
        });
        this.ui.actions = document.querySelectorAll('.action-btn');
    },

    processTurn() {
        const actor = this.turnManager.getCurrentActor();
        this.ui.turnIndicator.textContent = `${actor.name}'s Turn`;
        this.ui.turnIndicator.style.color = actor === this.player ? '#99e550' : '#ac3232';

        if (actor === this.player) {
            this.enablePlayerControls(true);
        } else {
            this.enablePlayerControls(false);
            setTimeout(() => this.enemyTurn(), 1000);
        }
    },

    enablePlayerControls(enabled) {
        this.ui.actions.forEach(btn => {
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? '1' : '0.5';
        });
    },

    handlePlayerAction(key) {
        if (!this.isActive) return;

        let actionDone = false;
        if (key === '1') {
            this.performAttack(this.player, this.enemy);
            actionDone = true;
        } else if (key === '2') {
            actionDone = this.performSkill(this.player, this.enemy);
        } else if (key === '3') {
            actionDone = this.useItem(this.player);
        } else if (key === 'Space') {
            this.log('Player skipped turn.');
            actionDone = true;
        }

        if (actionDone) {
            this.checkCombatStatus();
            if (this.isActive) {
                this.turnManager.nextTurn();
                this.processTurn();
            }
        }
    },

    performSkill(attacker, defender) {
        if (attacker.currentMana < 10) {
            this.log("Not enough mana!");
            this.showFloatingText("No Mana!", attacker, '#5fcde4');
            return false;
        }

        const cls = attacker.charClass || 'warrior';
        let dmg = 0;
        let name = "Skill";

        if (cls === 'warrior') {
            name = "Heavy Strike";
            dmg = Math.floor(Math.random() * 8) + 5 + attacker.stats.derived.mods.str * 2;
        } else if (cls === 'mage') {
            name = "Fireball";
            dmg = Math.floor(Math.random() * 10) + 5 + attacker.stats.derived.mods.int * 2;
        } else if (cls === 'rogue') {
            name = "Eviscerate";
            dmg = Math.floor(Math.random() * 6) + 5 + attacker.stats.derived.mods.dex * 2;
        }

        attacker.currentMana -= 10;
        defender.currentHp -= dmg;

        this.log(`${attacker.name} uses ${name} for ${dmg} damage!`);
        this.showFloatingText(`${name}! ${dmg}`, defender, '#fbf236');

        this.updateUI();
        return true;
    },

    useItem(user) {
        const potionIdx = user.inventory.findIndex(i => i.id === 'potion_hp');
        if (potionIdx === -1) {
            this.log("No potions!");
            return false;
        }

        const potion = user.inventory.splice(potionIdx, 1)[0];
        const heal = potion.effect.hp;

        user.currentHp = Math.min(user.currentHp + heal, user.stats.derived.maxHp);

        this.log(`Used ${potion.name}, healed ${heal} HP.`);
        this.showFloatingText(`+${heal} HP`, user, '#99e550');

        this.updateUI();
        return true;
    },

    enemyTurn() {
        if (!this.isActive) return;
        this.performAttack(this.enemy, this.player);
        this.checkCombatStatus();
        if (this.isActive) {
            this.turnManager.nextTurn();
            this.processTurn();
        }
    },

    performAttack(attacker, defender) {
        const startD20 = Math.floor(Math.random() * 20) + 1;
        const hitRoll = startD20 + attacker.stats.derived.attackPower;
        const ac = defender.stats.derived.defense;

        console.log(`${attacker.name} attacks! Roll: ${startD20} + ${attacker.stats.derived.attackPower} = ${hitRoll} vs AC ${ac}`);

        if (hitRoll >= ac) {
            const dmgBase = Math.floor(Math.random() * 6) + 1;
            const dmg = dmgBase + attacker.stats.derived.mods.str;
            let finalDmg = Math.max(1, dmg);
            defender.currentHp -= finalDmg;

            this.log(`${attacker.name} hits for ${finalDmg} damage!`);
            this.showFloatingText(finalDmg, defender);
        } else {
            this.log(`${attacker.name} missed!`);
            this.showFloatingText("Miss", defender, 'white');
        }

        this.updateUI();
    },

    checkCombatStatus() {
        if (this.player.currentHp <= 0) {
            this.endCombat(false);
        } else if (this.enemy.currentHp <= 0) {
            this.endCombat(true);
        }
    },

    endCombat(victory) {
        this.isActive = false;
        this.enablePlayerControls(false);

        if (victory) {
            this.log("Victory!");
            const xp = 100;
            alert(`Victory! Gained ${xp} XP.`);

            // Generate Loot
            const drop = LootSystem.spawnLoot(this.enemy.gridX, this.enemy.gridY, 1);
            if (drop) {
                this.log(`Dropped: ${drop.item.name}`);
                alert(`You found: ${drop.item.name}`);

                // Add to Inventory
                if (this.player.inventory) {
                    this.player.inventory.push(drop.item);
                }
            }

            Game.world.level.entities = Game.world.level.entities.filter(e => e !== this.enemy);
            Game.switchState('PLAYING');
        } else {
            Game.switchState('GAMEOVER');
            if (document.getElementById('run-stats')) {
                document.getElementById('run-stats').textContent = "Slain by " + this.enemy.name;
            }
            // Trigger Meta Save logic here in the future
            import('../core/auth.js').then(m => {
                const meta = m.Auth.getMeta();
                meta.runs = (meta.runs || 0) + 1;
                m.Auth.saveMeta(meta);
            });
        }
    },

    updateUI() {
        const pStats = this.player.stats.derived;
        if (pStats) {
            // Update HP Bar
            const hpText = document.querySelector('#hp-bar .bar-text');
            const hpFill = document.querySelector('#hp-bar .bar-fill');
            if (hpText) hpText.textContent = `${this.player.currentHp}/${pStats.maxHp}`;
            if (hpFill) {
                const pct = Math.max(0, (this.player.currentHp / pStats.maxHp) * 100);
                hpFill.style.width = `${pct}%`;
                // console.log(`[UI] HP: ${this.player.currentHp}/${pStats.maxHp} = ${pct}%`);
            }

            // Update Mana Bar
            const mpText = document.querySelector('#mana-bar .bar-text');
            const mpFill = document.querySelector('#mana-bar .bar-fill');
            if (mpText) mpText.textContent = `${this.player.currentMana}/${pStats.maxMana}`;
            if (mpFill) {
                const pct = Math.max(0, (this.player.currentMana / pStats.maxMana) * 100);
                mpFill.style.width = `${pct}%`;
            }
        }
    },

    log(msg) {
        console.log(`[Combat] ${msg}`);
    },

    showFloatingText(text, entity, color = '#ac3232') {
        Game.floatingTexts = Game.floatingTexts || [];
        Game.floatingTexts.push({
            text: text,
            x: entity.pixelX,
            y: entity.pixelY - 20,
            life: 1.0,
            color: color
        });
    }
};
