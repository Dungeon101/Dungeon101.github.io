# Dungeon101

Dungeon101 is a web-based dungeon crawler game built with Phaser 3. Explore procedurally generated dungeons, battle enemies, and face challenging bosses as you progress through increasingly difficult floors.

## Project Structure

dungeon101.github.io/
├── assets/
│ └── images/
│ │ ├── characters/
│ │ ├── dungeon/
│ │ ├── effects/
│ │ ├── enemies/
│ │ └── ui/
├── css/
│ └── style.css
├── js/
│ ├── scenes/
│ │ ├── BootScene.js
│ │ ├── CharacterSelectScene.js
│ │ ├── CombatScene.js
│ │ ├── DungeonScene.js
│ │ ├── MainMenuScene.js
│ │ └── PreloadScene.js
│ ├── systems/
│ │ └── DungeonGenerator.js
│ ├── ui/
│ │ └── HealthBar.js
│ ├── config.js
│ ├── game.js
│ └── GameState.js
├── index.html
└── README.md


## Directory Overview

### `assets/`
Contains all static assets used in the game.
- `css/`: Stylesheets for the game's HTML structure.
- `images/`: Graphics for characters, dungeon elements, effects, enemies, and UI components.

### `js/`
Contains all JavaScript files that power the game logic.
- `scenes/`: Phaser scenes that represent different states of the game (e.g., main menu, character selection, dungeon exploration, combat).
- `systems/`: Core game systems, such as the dungeon generator.
- `ui/`: User interface components, like the health bar.
- Root JS files: Configuration, main game initialization, and global state management.

### `index.html`
The main HTML file that loads all necessary scripts and provides the game container.

## Key Components

- **DungeonGenerator**: Creates procedurally generated dungeon layouts.
- **GameState**: Manages the global state of the game, including player party and current floor.
- **Scenes**: 
  - BootScene: Initial loading and setup.
  - PreloadScene: Loads all game assets.
  - MainMenuScene: Displays the main menu.
  - CharacterSelectScene: Allows players to choose their party.
  - DungeonScene: Handles dungeon exploration and enemy encounters.
  - CombatScene: Manages turn-based combat against enemies and bosses.

## Getting Started

To run the game locally:

1. Clone this repository.
2. Open `index.html` in a modern web browser.

For development:

1. Make sure you have a local web server set up (e.g., using Python's `http.server` or Node.js' `http-server`).
2. Run the local server in the project root directory.
3. Open the provided local URL in your browser.

## Contributing

If you'd like to contribute to Dungeon101, please fork the repository and create a pull request with your changes.



