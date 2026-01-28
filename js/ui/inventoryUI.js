import { Game } from '../core/game.js';

export const InventoryUI = {
    isOpen: false,

    init() {
        // Create DOM elements dynamically or assume they exist? 
        // Let's create a dynamic overlay since index.html is getting crowded
        const div = document.createElement('div');
        div.id = 'overlay-inventory';
        div.className = 'overlay hidden';
        div.innerHTML = `
            <div class="overlay-content">
                <h2>Inventory</h2>
                <ul id="inventory-list" style="list-style: none; padding: 0; text-align: left; max-height: 300px; overflow-y: auto;">
                    <!-- Items go here -->
                </ul>
                <button id="btn-close-inventory" class="btn-close">X</button>
            </div>
        `;
        document.getElementById('app').appendChild(div);

        // Bind helpers
        document.getElementById('btn-close-inventory').addEventListener('click', () => this.close());

        // Toggle key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'i' || e.key === 'I') {
                this.toggle();
            }
        });
    },

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    },

    open() {
        if (!Game.player) return;
        this.isOpen = true;
        document.getElementById('overlay-inventory').classList.remove('hidden');
        this.render();
    },

    close() {
        this.isOpen = false;
        document.getElementById('overlay-inventory').classList.add('hidden');
    },

    render() {
        const list = document.getElementById('inventory-list');
        list.innerHTML = '';

        const items = Game.player.inventory || [];
        if (items.length === 0) {
            list.innerHTML = '<li style="padding: 1rem; color: gray;">Empty bag...</li>';
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');
            li.style.padding = '0.5rem';
            li.style.borderBottom = '1px solid #333';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';

            // Color by rarity
            let color = '#fff';
            if (item.rarity === 'uncommon') color = '#99e550';
            if (item.rarity === 'rare') color = '#5b6ee1';
            if (item.rarity === 'legendary') color = '#ac3232';

            li.innerHTML = `
                <span style="color: ${color}">${item.name}</span>
                <small>${item.type}</small>
            `;
            list.appendChild(li);
        });
    }
};
