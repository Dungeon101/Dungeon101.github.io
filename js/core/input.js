export const Input = {
    keys: {},
    keysPressed: {}, // For single frame triggers
    mouse: { x: 0, y: 0, left: false },

    init() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.keysPressed[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mousedown', () => {
            this.mouse.left = true;
        });

        window.addEventListener('mouseup', () => {
            this.mouse.left = false;
        });
    },

    update() {
        // Clear frame-based flags
        this.keysPressed = {};
    },

    isDown(code) {
        return this.keys[code];
    },

    isPressed(code) {
        return this.keysPressed[code];
    }
};
