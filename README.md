# ZONA-73: KOMBINAT — 3D Slavapunk Extraction Shooter

A playable, browser-based first-person 3D Slavapunk extraction shooter inspired by *Escape from Tarkov*, *S.T.A.L.K.E.R.*, and *Metro*, built with modular TypeScript, a custom WebGL2/WebGL1 3D engine, and Web Audio API procedural sound synthesis.

## Key Features

- **Custom 3D WebGL Renderer & Slavapunk Environment**:
  - Explorable post-Soviet industrial settlement (**Byelozersk Electro-Chemical Combine #73**) with a 3-story Khrushchyovka apartment block (*Dom B-4*), multi-story red-brick *Turbine Hall #2* with smokestacks and steam turbines, northern rail yard, wayside shrine, checkpoints, and rotating lattice windmill.
  - Smooth curved 3D geometry (tapered cylindrical tree trunks/limbs, sloped vehicles with round 12-segment tires, conical BTR-70 turret) and alpha-cutout vegetation (`grass_alpha` and `branch_alpha`) swaying in the wind.
  - ACES filmic tone mapping, dynamic point lights, wet asphalt puddle reflections, and tactical flashlight cone illumination.
- **True 3D Iron Sights & Overhauled Weapon Viewmodels**:
  - 4 playable Warsaw Pact firearms (`AKS-74U 5.45x39mm`, `PMM 9x18mm Makarov`, `TOZ-106 20ga Bolt-Action Shotgun`, and `SVDS 7.62x54mmR Marksman Rifle`) built with 35+ mechanical sub-parts and brushed parkerized `gunmetal` textures.
  - Holding **RMB** aligns the camera along the exact 3D optical axis of the physical rear sight notch and front sight post/tritium dot while automatically fading out the 2D HUD crosshair.
  - Hold **`[Shift]`** while aiming to **Hold Breath** and stabilize sight sway, or press **`[V]`** with the SVDS to toggle between the **PSO-1 4x24 optical scope** and **3D Backup Iron Sights**.
- **Articulated Enemy Ragdoll Physics & Blood System**:
  - Hostile AI factions (*Zone Scavengers*, *Brigadir Syndicate*, and *Varta-73 Containment Troops*) with wall-occluded line-of-sight perception, sound investigation, combat radio barks, and hit-flinch stagger reactions.
  - Multi-body articulated 3D ragdoll physics on death driven by bullet impulse vectors, complete with dropped weapon physics, high-velocity arterial blood spray droplets, blood aerosol mist, and expanding ground blood pools/splatters.
- **Spatial Grid Inventory, Visual Item Illustrations, Traders & Hideout Progression**:
  - Full drag-and-drop and `Ctrl+Click` spatial grid inventory (`Stash`, `Chest Rig`, `Backpack`, `Secure Case`, and `World/Corpse Loot Containers`) with custom SVG vector illustrations for all 26 weapons and items.
  - 3 Traders (*Warrant Officer Voronov*, *Dr. Elena Koval*, *Sidor "Mole"*), Hideout infrastructure upgrades, and persistent save storage via `IndexedDB` + `localStorage`.

## Project Structure

- `index.html` — Self-contained playable build (open directly in any desktop browser or host via GitHub Pages).
- `src/types/game.ts` — Core TypeScript interfaces for weapons, items, AI, ragdolls, blood decals, and persistence.
- `src/data/itemsAndWeapons.ts` — Weapon ballistics, 26 item templates, trader catalogs, and custom SVG vector illustrations (`renderItemGraphicSVG`).
- `src/engine/textures.ts` — 16 procedural PBR-style and alpha-cutout textures (`grass_alpha`, `branch_alpha`, `gunmetal`, etc.).
- `src/engine/webgl.ts` — WebGL2/WebGL1 3D renderer, ACES tone mapping, humanoid/ragdoll renderer, and 3D weapon viewmodels with true iron-sight alignment.
- `src/engine/worldBuilder.ts` — Level design and geometry builder for Sector Kombinat-73.
- `src/engine/physicsAndPlayer.ts` — First-person controller, collision detection, ballistic raycasting, and hold-breath stabilization.
- `src/engine/aiSystem.ts` — Tactical AI state machine and articulated multi-body ragdoll physics solver.
- `src/engine/audioEngine.ts` — Web Audio API spatial sound synthesizer.
- `src/engine/inventoryAndPersistence.ts` — Spatial grid inventory logic and `IndexedDB` / `localStorage` persistence.
- `src/ui/gameApp.ts` — Main application loop, HUD, Stash, Traders, Hideout, and Settings UI.
- `scripts/build_game.js` — Bundles the modular TypeScript sources into `index.html`.
