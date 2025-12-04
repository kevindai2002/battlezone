# Battlezone WebGL Game

A simple 3D implementation of the classic Battlezone arcade game using WebGL.

## Description
This is a modern WebGL version of Battlezone where you control a tank on a 2D battlefield viewed in 3D perspective. Destroy enemy tanks while avoiding their shots. The game features a radar view to track enemies and obstacles on the battlefield.

## How to Run
1. Open `index.html` in a modern web browser that supports WebGL
2. The game will start automatically

## Controls
- **Arrow Up**: Move forward
- **Arrow Down**: Move backward
- **Arrow Left**: Turn left
- **Arrow Right**: Turn right
- **Space**: Shoot
- **!**: Toggle alternate visual mode

## Gameplay
- Destroy enemy tanks by shooting them
- Avoid enemy shots by moving
- You cannot move through obstacles or enemy tanks
- When destroyed, you respawn at the same location with temporary invulnerability
- Enemy tanks spawn at random edge locations when destroyed

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