Project-specific Copilot instructions
===============================

Purpose
-------
- Give AI coding agents the minimal, high-value context to be productive in this mono-repo.

Quick architecture summary
--------------------------
- This repository is a multi-package Aux/CasualOS project. Top-level packages live under `packages/` (for example [packages/seed-bible/app](packages/seed-bible/app)).
- Runtime artifacts are Aux packages (JSON `.aux`) produced/consumed by `casualos` tools. The repo uses `casualos pack-aux` and `casualos unpack-aux` in scripts in `script/`.
- Local developer flow often runs an instrumented browser via the dev script which packages selected extensions and opens a Puppeteer-controlled page: see [script/dev.ts](script/dev.ts).

Essential commands (run with pnpm)
---------------------------------
- `pnpm dev` — start interactive dev environment (calls `tsx script/dev.ts`). Puppeteer opens a browser and uploads packages.
- `pnpm build` — run repository build logic (`script/build.ts`).
- `pnpm test` — run Jest tests. `pnpm pretest` runs TypeScript checks via `tsx script/pretest.ts`.
- `pnpm package` / `pnpm package:seed-bible` — create Aux packages with `casualos pack-aux`.
- `pnpm check` — run `tsc-silent` using the repo `tsconfig.json` (used by CI).

Project conventions & patterns
-----------------------------
- Package layout: each package under `packages/<name>/` typically contains `extension.json`, `extra.aux`, and live source in a subfolder (e.g., `packages/seed-bible/app`). Use lowercase package names when invoking packaging commands.
- Scripts in `script/` are the canonical place for developer tooling (see [script/package.ts](script/package.ts) and [script/dev.ts](script/dev.ts)). Prefer updating/adding behavior there instead of ad-hoc CLI hacks.
- Tests use Jest and TypeScript. Type checking is done separately via `tsc-silent`.
- Repository uses pnpm; the lockfile is `pnpm-lock.yaml` and `packageManager` in `package.json` pins pnpm version.
- Some dependencies are patched via `patches/` and configured in `package.json` under `pnpm.patchedDependencies`.

Integration points & external tools
----------------------------------
- `casualos` CLI: used for packing/unpacking Aux files (`pack-aux`, `unpack-aux`). Scripts assume `casualos` is installed as a dev dependency.
- Puppeteer: the interactive dev environment opens a browser and runs automation (`script/dev.ts`). When modifying dev flows, check Puppeteer launch options (headless/devtools flags) in that file.
- `aux-runtime` / `aux-vm`: runtime libraries under `devDependencies` are required for packaging and runtime behaviors.

> Examples
>- To add a new UI package: create `packages/<your-name>/` with an `extension.json` and source folder, then add it to packaging by name or to `DEFAULT_EXTENSIONS` in [script/lib/browser.js](script/lib/browser.js).
>- To debug why `pnpm dev` doesn't load changes: ensure `casualos pack-aux` ran for the package (scripts call `packageSingle`), and check the browser console in the Puppeteer window launched by [script/dev.ts](script/dev.ts).

When editing code
-----------------
- Preserve Aux packaging metadata (`extension.json`) structure. Tests, packaging, and the dev loader rely on extension fields and `extra.aux`.
- Prefer adding developer flags to `script/argumentUtil.ts` and handling them in `script/dev.ts` instead of ad-hoc argv parsing.

Files to inspect first
----------------------
- [package.json](package.json) — canonical scripts and devDependencies.
- [script/dev.ts](script/dev.ts) — interactive development flow, Puppeteer usage.
- [script/package.ts](script/package.ts) and [script/build.ts](script/build.ts) — packaging and build logic.
- `packages/<pkg>/extension.json` — package metadata used by runtime.

If unsure, ask the developer
----------------------------
- Ask which package(s) should be bundled for a change (many scripts assume a package name). Clarify whether changes should update `.aux` outputs in `dist/` or runtime source under `packages/`.

Revision note
-------------
- Created to provide concise, actionable instructions for AI coding agents. Please review and tell me any missing project-specific commands or conventions to include.
