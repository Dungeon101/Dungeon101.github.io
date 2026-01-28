# Dungeon101

Dungeon101 is a browser-based **2D fantasy RPG** with **turn-based combat**, **procedural generation**, and **roguelite meta-progression**.  
Each run is unique. Death is permanent. Progress is eternal.

---

## Overview

Dungeon101 focuses on classic RPG mechanics inspired by D&D-style systems and old-school fantasy games.  
Players explore a procedurally generated overworld, enter dangerous dungeons, and face powerful bosses.

When a character dies, the run ends — but permanent bonuses, unlocked talents, and special relics persist, making future runs stronger and more strategic.

---

## Core Features

- **2D Top-Down RPG**
- **Turn-Based Combat**
- **Procedural Overworlds and Dungeons**
- **Permadeath with Meta-Progression**
- **Class-Based Gameplay**
  - Warrior
  - Mage
  - Rogue
- **Visual Talent Trees per Class**
- **Unique Boss Mechanics**
- **Partial Loot Inheritance Between Runs**
- **Google Authentication**
- **Persistent Saves (localStorage-based)**

---

## Gameplay Loop

1. Log in with Google
2. Create a character and choose a class
3. Explore the overworld
4. Enter procedurally generated dungeons
5. Fight enemies using turn-based combat
6. Collect loot and unlock talents
7. Defeat bosses
8. Die, inherit legacy bonuses, and start again stronger

---

## Tech Stack

- **HTML5**
- **CSS3**
- **JavaScript (ES6+)**
- **HTML5 Canvas**
- No frameworks or external libraries

---

## Graphics

Dungeon101 uses the **Tiny Swords** asset pack by PixelFrog for all tiles, characters, and environments.

---

## Project Structure (Example)
/src
/core
gameLoop.js
turnSystem.js
/player
player.js
classes.js
talentTrees.js
/systems
combatSystem.js
bossSystem.js
lootSystem.js
metaProgression.js
proceduralGeneration.js
saveSystem.js
/ui
hud.js
menus.js
/auth
googleAuth.js
/data
balanceConstants.js
index.html
style.css
main.js

---

## Permadeath & Meta-Progression

- Characters are permanently lost on death
- Each new run starts at level 1
- Permanent bonuses unlock between runs:
  - Extra starting stat points
  - New base talents
  - Increased rare loot chances
- Special relics can carry over between runs

---

## Running the Game

Simply open `index.html` in a modern browser.

No build step required.

---

## License

This project is for educational and experimental purposes.
