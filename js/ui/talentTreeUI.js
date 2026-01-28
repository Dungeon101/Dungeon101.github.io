import { Talents } from '../data/talents.js';
import { Game } from '../core/game.js';

export const TalentTreeUI = {
    canvas: null,
    ctx: null,
    isOpen: false,
    activeClass: 'warrior',

    talents: [],
    playerRef: null,

    init() {
        this.canvas = document.getElementById('talent-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.canvas.width = 800;
        this.canvas.height = 500;

        document.addEventListener('keydown', (e) => {
            if (e.key === 't' || e.key === 'T') {
                this.toggle();
            }
        });

        document.getElementById('btn-close-talents').addEventListener('click', () => {
            this.close();
        });

        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    },

    setTalents(talents, player) {
        this.talents = talents;
        this.playerRef = player;
        this.activeClass = player.charClass || 'warrior';
    },

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    },

    open() {
        if (!Game.player) return;
        this.isOpen = true;
        document.getElementById('overlay-talents').classList.remove('hidden');
        this.draw();
    },

    close() {
        this.isOpen = false;
        document.getElementById('overlay-talents').classList.add('hidden');
    },

    draw() {
        if (!this.isOpen) return;

        // Background
        this.ctx.fillStyle = '#14182e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px "Press Start 2P"';
        let pts = 0;
        if (this.playerRef) pts = this.playerRef.talentPoints || 0;
        this.ctx.fillText(`Points: ${pts}`, 20, 40);

        const nodes = this.talents;
        if (!nodes || nodes.length === 0) return;

        // Draw Connections First
        this.ctx.strokeStyle = '#5b6ee1';
        this.ctx.lineWidth = 4;

        nodes.forEach(node => {
            if (node.req && node.req.length > 0) {
                node.req.forEach(reqId => {
                    const parent = nodes.find(n => n.id === reqId);
                    if (parent) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(parent.x, parent.y);
                        this.ctx.lineTo(node.x, node.y);
                        this.ctx.stroke();
                    }
                });
            }
        });

        // Draw Nodes
        const currentPoints = this.playerRef ? (this.playerRef.talentPoints || 0) : 0;
        nodes.forEach(node => {
            const isUnlocked = node.unlocked;
            const canUnlock = this.checkRequirements(node) && currentPoints >= node.cost;

            // Color
            if (isUnlocked) this.ctx.fillStyle = '#99e550'; // Green
            else if (canUnlock) this.ctx.fillStyle = '#fbf236'; // Yellow
            else this.ctx.fillStyle = '#595652'; // Grey

            // Circle
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 30, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = '#fff';
            this.ctx.stroke();

            // Text
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Roboto';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(node.name, node.x, node.y + 45);
            this.ctx.font = '10px Roboto';
            this.ctx.fillText(`${node.cost} pts`, node.x, node.y + 60);
        });
    },

    handleClick(e) {
        if (!this.isOpen) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const nodes = this.talents;
        if (!nodes) return;

        for (const node of nodes) {
            // Circle hit test
            const dist = Math.sqrt(Math.pow(mouseX - node.x, 2) + Math.pow(mouseY - node.y, 2));
            if (dist <= 30) {
                this.tryUnlock(node);
                break;
            }
        }
    },

    checkRequirements(node) {
        if (!node.req || node.req.length === 0) return true;

        // All reqs must be UNLOCKED
        const nodes = this.talents;
        return node.req.every(reqId => {
            const p = nodes.find(n => n.id === reqId);
            return p && p.unlocked;
        });
    },

    tryUnlock(node) {
        if (node.unlocked) return; // Already owned

        const pts = this.playerRef ? (this.playerRef.talentPoints || 0) : 0;

        if (this.checkRequirements(node) && pts >= node.cost) {
            if (this.playerRef) this.playerRef.talentPoints -= node.cost;
            node.unlocked = true;
            console.log(`Unlocked Talent: ${node.name}`);
            this.draw();

            // Apply Effects
            if (this.playerRef) {
                this.playerRef.recalcStats();
                console.log("Stats Recalculated");
            }
        } else {
            console.log("Cannot unlock");
            console.log(`Req: ${this.checkRequirements(node)}, Points: ${pts}/${node.cost}`);
        }
    }
};
