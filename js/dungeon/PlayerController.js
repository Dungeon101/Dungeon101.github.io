class PlayerController {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.moveSpeed = 3;
        this.isTouching = false;
        this.touchStartX = 0;
        this.touchStartY = 0;

        // Add touch event listeners
        this.scene.input.on('pointerdown', this.onTouchStart, this);
        this.scene.input.on('pointermove', this.onTouchMove, this);
        this.scene.input.on('pointerup', this.onTouchEnd, this);
    }

    update() {
        if (!this.isTouching) {
            this.handleKeyboardInput();
        }
    }

    handleKeyboardInput() {
        let dx = 0;
        let dy = 0;

        if (this.cursors.left.isDown) {
            dx = -this.moveSpeed;
        } else if (this.cursors.right.isDown) {
            dx = this.moveSpeed;
        }

        if (this.cursors.up.isDown) {
            dy = -this.moveSpeed;
        } else if (this.cursors.down.isDown) {
            dy = this.moveSpeed;
        }

        this.movePlayer(dx, dy);
    }

    onTouchStart(pointer) {
        this.isTouching = true;
        this.touchStartX = pointer.x;
        this.touchStartY = pointer.y;
    }

    onTouchMove(pointer) {
        if (!this.isTouching) return;

        const dx = pointer.x - this.touchStartX;
        const dy = pointer.y - this.touchStartY;

        // Adjust sensitivity as needed
        const sensitivity = 0.5;
        this.movePlayer(dx * sensitivity, dy * sensitivity);

        // Update touch start position for smoother movement
        this.touchStartX = pointer.x;
        this.touchStartY = pointer.y;
    }

    onTouchEnd() {
        this.isTouching = false;
    }

    movePlayer(dx, dy) {
        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx = dx / length * this.moveSpeed;
            dy = dy / length * this.moveSpeed;
        }

        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        // Check for collisions and update player position
        if (!this.scene.checkCollision(newX, newY)) {
            this.player.x = newX;
            this.player.y = newY;
            this.scene.updateFogOfWar();
        }
    }
}