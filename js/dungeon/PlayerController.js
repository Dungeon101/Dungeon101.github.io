class PlayerController {
    constructor(scene) {
        this.scene = scene;
    }

    handlePlayerMovement() {
        if (!this.scene.player) return;

        const speed = 100;
        this.scene.player.setVelocity(0);

        if (this.scene.cursors.left.isDown) {
            this.scene.player.setVelocityX(-speed);
        } else if (this.scene.cursors.right.isDown) {
            this.scene.player.setVelocityX(speed);
        }

        if (this.scene.cursors.up.isDown) {
            this.scene.player.setVelocityY(-speed);
        } else if (this.scene.cursors.down.isDown) {
            this.scene.player.setVelocityY(speed);
        }

        this.scene.player.body.velocity.normalize().scale(speed);
    }
}