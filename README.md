# Dungeon101

Dungeon101 is an engaging web-based dungeon crawler game built with Phaser 3. Embark on a thrilling adventure as you explore procedurally generated dungeons, battle fierce enemies, and face challenging bosses while progressing through increasingly difficult floors.

## Features

- Procedurally generated dungeons for unique experiences each playthrough
- Turn-based combat system with strategic depth
- Four distinct character classes: Warrior, Mage, Rogue, and Healer
- Special abilities for each character class
- Progressive difficulty with increasingly challenging enemies and boss fights
- Persistent game state with character progression

## How to Play

1. **Character Selection**: Choose your party of four characters from the available classes. Each class has unique strengths and abilities.

2. **Dungeon Exploration**: Navigate through the dungeon using arrow keys. Explore rooms and corridors while avoiding or engaging enemies.

3. **Combat**: 
   - Battles are turn-based. Characters and enemies take turns based on their agility stat.
   - Select a target by clicking on an enemy sprite.
   - Use character abilities by clicking on the ability icons below each character.
   - Plan your strategy carefully, using your party's strengths to overcome challenges.

4. **Progression**: 
   - Defeat enemies to progress through the dungeon.
   - Every 5th floor features a challenging boss fight.
   - Characters gain improved stats as you progress through floors.

5. **Game Over**: The game ends if all party members are defeated. Try again with a new strategy!

## Getting Started

To run the game locally:

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/dungeon101.git
   ```
2. Navigate to the project directory:
   ```
   cd dungeon101
   ```
3. Open `index.html` in a modern web browser.

For development:

1. Set up a local web server (e.g., using Python's `http.server` or Node.js' `http-server`).
2. Run the local server in the project root directory.
3. Open the provided local URL in your browser.

## Project Structure

dungeon101/
├── assets/
│ └── images/
│ ├── characters/
│ ├── dungeon/
│ ├── effects/
│ ├── enemies/
│ └── ui/
├── css/
│ └── style.css
├── js/
│ ├── combat/
│ ├── dungeon/
│ ├── scenes/
│ ├── ui/
│ ├── config.js
│ ├── game.js
│ └── GameState.js
├── index.html
├── LICENSE
└── README.md


## Contributing

Contributions to Dungeon101 are welcome! If you'd like to contribute:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and commit them with clear, descriptive messages.
4. Push your changes to your fork.
5. Create a pull request, describing the changes you've made.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Phaser 3](https://phaser.io/) - The game framework used
- [OpenGameArt](https://opengameart.org/) - For some of the game assets

Enjoy your adventure in Dungeon101!