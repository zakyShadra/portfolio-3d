# openworld3d

A small open-world 3D exploration demo built with vanilla [Three.js](https://threejs.org/) — no game engine, no heavyweight framework. Procedurally generated terrain, a walking/running/jumping character, a drag-to-orbit third-person camera, and a slow day–night cycle.

## Run it

```bash
npm install
npm run dev
```

Open the printed `localhost` URL.

## Controls

- `W A S D` / arrow keys — move
- `Shift` — run
- `Space` — jump
- Drag mouse — orbit camera
- Scroll — zoom

## How it's built

- `src/noise.js` — a self-contained fractal value-noise generator (no dependency) used to shape the terrain and place objects deterministically.
- `src/terrain.js` — generates a displaced, vertex-colored ground mesh from the noise field.
- `src/scatter.js` — procedurally scatters trees and rocks across the terrain using a seeded RNG.
- `src/player.js` — character movement, gravity/jump, and a simple walk-bob animation. Height is sampled directly from the same noise function as the terrain, so the character always sticks to the ground without raycasting.
- `src/sky.js` — gradient sky dome and drifting cloud sprites.
- `src/main.js` — wires the scene together: lighting (with a looping day–night cycle), the third-person camera rig, input handling, and the render loop.

## Ideas to extend

- Swap the capsule placeholder for a rigged GLTF character + animation mixer
- Add collectibles / simple quests
- Chunked terrain streaming for a bigger world
- Mobile touch controls
- Simple enemies or wildlife with basic AI
