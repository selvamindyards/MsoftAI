# MsoftAI

Browser-based hydraulic and instrument manifold block design. A MindYards product (Selva, Mindyards / Krion). No dependency on any CAD package. Live at https://msoftai.mindyards.in, deployed from `main` by GitHub Actions to GitHub Pages.

## Background

- 2004: Selva built the original as a .NET add-in for Autodesk Inventor, modelled on VEST Inc.'s MDTools (then version 705), during PhD work at the Design and Fabrication Lab, IIT Delhi.
- ~2016: rewritten as an Electron + three.js app ("Nakal") with colleague Gopal. Source recovered in Oct 2026 from an old installer stored in Gmail. That code is reference only, kept at `C:\Selva\Files\Mindyards\Nakal\`. The MDTools 760 user manual (same folder) is the functional reference for features and terminology.
- Oct 2026: this repository started from scratch as a SaaS product named MsoftAI.

## Product rules

- The name is MsoftAI. Never use "MD Tools" or "MDTools" in UI, titles or docs; it is VEST's trademark. The manual is a reference for concepts only; do not copy its UI text or dialog layouts.
- Phase 1 is manifold block design. Later: connections with computed drill depth, nets, wall-thickness and meet-list checks, machining chart, drawings, then AI features (schematic-to-layout, conversational design, catalogue ingestion).
- The recovered cavity library (461 cavities, 632 footprint holes) is kept for now and will be rebuilt from manufacturer catalogues and standards before commercial use.
- First target customers are instrument-manifold style blocks (Emerson/Rosemount type) as well as hydraulic manifolds; an instrumentation library (NPT ports, Coplanar flange patterns) is still missing.

## Architecture

- Vite + TypeScript + three.js, Vitest for the geometry model. `npm run dev`, `npm test`, `npm run build` (type-checks first).
- `src/model/` is the pure data model, independent of rendering: block, six face frames (`faces.ts`), step-stack cavity profiles (`profile.ts`), design file (`design.ts`), library (`library.ts`). Keep geometry logic here and tested.
- World axes: X = length, Y = height (up), Z = width; block occupies [0,L]x[0,H]x[0,W]. Face-local (x, y) from each face's origin corner; faces labelled A Top, B Front, C Bottom, D Left, E Right, F Back (MDTools convention).
- Cavity = up to 13 steps (diameter, cumulative depth from surface, bottom cone half-angle: 59/60 = drill point, 90 = flat, 1.8 = NPT taper). Rendered as a revolved profile (LatheGeometry).
- Footprint children link to their parent cavity by (library, CavityFootPrintIndex); the index is only unique within a library.
- `src/render/viewer.ts`: three.js scene, selection, interactive placement mode (hover a face, ghost follows pointer, click to place), six orthographic snapshots.
- `src/ui/app.ts`: side panel UI built with plain DOM.
- Auth and data: Supabase project `brptqofvjhtlfqxruvaw` (org Mindyards). Config in `src/auth/config.ts` (publishable key is browser-safe). Tables: `profiles` (approval + role), `designs` (per user), `library_cavities`, `library_footprints`. All access is enforced by row-level security; SQL lives in `supabase/`. New accounts need admin approval in the app's Users section.
- The library JSON in `data/library/` is the development copy and is not shipped; `tools/convert-library.mjs` regenerates it and `supabase/seed_library.sql` from the legacy data file.
- Source maps are disabled in production builds.

## Operations

- GitHub: `selvamindyards/MsoftAI`. The `gh` CLI on Selva's PC is logged in as `krionSK`, a write collaborator, not admin: pushes work, repo settings and Pages settings must be changed by Selva in the GitHub UI.
- DNS stays at GoDaddy: CNAME `msoftai` -> `selvamindyards.github.io`.
- Supabase settings still to confirm: Site URL and redirect URL set to `https://msoftai.mindyards.in`; repo should be switched to Private (account is on GitHub Pro).

## Working style

- Selva knows this domain deeply (20+ years); speak as a peer and be candid about trade-offs and risks.
- Verify UI changes in the browser before pushing; every push deploys to production.
- Shell commands over roughly 8 KB fail in this environment; write large files with the file tools.
