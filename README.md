# Battlezone WebGL Game

A simple 3D implementation of the classic Battlezone arcade game using WebGL.

## Description
This is a modern WebGL version of Battlezone where you control a tank on a 2D battlefield viewed in 3D perspective. Destroy enemy tanks while avoiding their shots. The game features a radar view to track enemies and obstacles on the battlefield.

The game includes two modes:
- **Normal Mode**: Classic first-person wireframe style
- **Alternate Mode** (press !): Third-person view with health system, waves, scoring, and power-ups

## How to Run
1. Open `index.html` in a modern web browser that supports WebGL
2. Click "START GAME" to begin
3. Press `!` (Shift+1) to toggle between Normal and Alternate modes

## Controls

### Normal Mode
- **Arrow Keys**: Move tank (Up/Down = forward/back, Left/Right = turn)
- **Space**: Shoot
- **!**: Toggle to Alternate Mode

### Alternate Mode
- **W/S**: Move forward/backward
- **A/D**: Rotate tank
- **Arrow Keys**: Rotate camera view
- **Space**: Shoot
- **ESC**: Instant game over (for testing)
- **!**: Toggle to Normal Mode

## Gameplay

### Normal Mode
- Destroy enemy tanks by shooting them
- Avoid enemy shots by moving
- You cannot move through obstacles, walls, or enemy tanks
- When destroyed, you respawn at the same location with temporary invulnerability
- Enemy tanks spawn at random edge locations when destroyed

### Alternate Mode
- **Health System**: Start with 150 HP, damage increases per wave (+1 per wave)
- **Lives System**: 3 lives - lose all HP to lose a life
- **Wave System**: Progress through waves by destroying all enemies
- **Score System**: Earn points for each kill (1 point × wave multiplier)
- **Power-ups**: Collect hearts to heal +20 HP or boost max HP +20
- **Arena Boundaries**: Walls surround the battlefield and act as obstacles
- **Progressive Difficulty**: Each wave spawns more enemies with increased damage
- **High Score**: Best score saved in browser localStorage

## Technical Details
- Built with pure WebGL (no external libraries)
- 3D perspective rendering for main view
- Orthographic overhead view for radar
- Simple geometric shapes (cubes, pyramids) for all models
- 2D gameplay physics on ground plane

## Author
Kevin Dai

## Course
CS 461/561 - Computer Graphics