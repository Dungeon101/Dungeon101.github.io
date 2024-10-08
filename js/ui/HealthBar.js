class HealthBar {
    constructor(scene, x, y, width, height) {
        this.bar = new Phaser.GameObjects.Graphics(scene);

        this.x = x;
        this.y = y;
        this.width = width * 0.5; // Reduce width to 80%
        this.height = height;

        this.draw();
        scene.add.existing(this.bar);
    }

    setHealth(health, maxHealth) {
        this.health = health;
        this.maxHealth = maxHealth;
        this.draw();
    }

    draw() {
        this.bar.clear();

        // Border
        this.bar.fillStyle(0x000000);
        this.bar.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

        // Health
        this.bar.fillStyle(0x00ff00);
        let d = Math.floor((this.health / this.maxHealth) * (this.width - 4));
        this.bar.fillRect(this.x - this.width / 2 + 2, this.y - this.height / 2 + 2, d, this.height - 4);
    }
}
