# CLAUDE.md

Notes for agents working in this repo. Skip the parts that don't apply to your task.

## What this repo is

CodeTango — a Codenames-style web game. Ionic + Angular frontend, Firebase
Auth/Firestore/Functions backend, deployed at https://codetango.web.app/.
Originally a hackathon project, still actively developed.

- Frontend: `src/` (Angular 19.2, Ionic 8, RxJS 7, chart.js 4)
- Cloud Functions: `functions/src/` (Firebase Functions 7 v1 API, Node 20)
- Shared types: `types.ts` at repo root (imported as bare `'types'` via
  tsconfig path mapping)

## Vetted-package registry — read this before any `npm install`

The org installs packages from a vetted-package mirror, not public npm:

```
# .npmrc
registry=https://greenflagged.dev/npm
legacy-peer-deps=true
```

Two things follow from this:

1. **Most transitive deps aren't vetted by default.** `package.json` has
   ~90 entries in `overrides` that pin each transitive dep to whatever the
   mirror has vetted. Some pin **forward** (to drop CVE-tainted versions —
   `serialize-javascript`, `path-to-regexp@6`, `tar@7`); some pin **back**
   (to keep CJS-only versions because firebase-tools' chain breaks at
   runtime on ESM-only newer versions — `xdg-basedir@4`, `unique-string@2`,
   `bl@4`, `is-obj@2`, etc.). **Don't delete overrides blindly.** Each
   exists for one of those two reasons.

2. **`npm install` from scratch may fail** if the mirror's vetted set
   doesn't match `package.json`'s declared versions. The remedy depends on
   what's missing:

   - **ETARGET** (version not in range): the existing overrides were picked
     by hand for this project; on a fresh clone, just re-running `npm install`
     against the locked `package.json` should be enough. If a new transitive
     dep is in range and unvetted, manually pin to the highest vetted version
     that satisfies, and request the missing range via greenflagged's web UI
     or MCP.
   - **E404** (package not in mirror): the registry auto-prioritizes
     packages requested via failed installs. Re-run `npm install` after
     ~30 s. If still missing after a few tries, request explicitly via the
     greenflagged MCP tool or web UI.
   - **Runtime TypeError** (`X is not a function`, `Cannot find module
     '...../package.json' is not defined by exports`): the override picked
     an ESM-only version of a CJS-consumed package. Find the older
     CJS-friendly version and pin to that instead. Pattern in
     `package.json` overrides: `bl: 4.1.0`, `unique-string: 2.0.0`, etc.

## Local dev — the env story

**`npm start` is local-only by default and must stay that way.**

`src/environments/environment.ts` points at the `demo-codetango` Firebase
project ID with fake credentials. The app's Firebase SDK refuses to talk
to a real backend on demo project IDs, and `app.module.ts` calls
`connectFirestoreEmulator` / `connectAuthEmulator` / `connectFunctionsEmulator`
during init. This is defense in depth: even if the env file got swapped,
the emulator-connect calls would still firewall the app from prod.

**Three env files, three purposes:**

- `environment.ts` — dev (demo + emulators). Used by `ng serve` and
  `ng build` without a configuration flag.
- `environment.prod.ts` — production. Used by `ng build --configuration=production`
  for actual deploys. Has `production: true` (enables service worker, etc.).
- `environment.prod-data.ts` — opt-in: `ng serve` against prod data with
  `production: false`. Triggered by `npm run start:prod-data`, which
  prints a red warning. Never wire this into the default workflow.

If you find yourself wanting to "make the dev server talk to prod" for any
reason — don't. Use `npm run start:prod-data` for one-off needs.

## Local emulators

`npm run emulators` boots auth, firestore, and functions against the
`demo-codetango` project. UI at http://127.0.0.1:4001/, hub at 4400,
auth 9099, firestore 8090, functions 5001.

This used to crash with `TypeError: pathRegexp is not a function`
because firebase-tools' emulator code (and its bundled express 4) needs
the callable `path-to-regexp@~0.1.x` API, and the global override pins
`6.3.0` (class-based) to satisfy the mirror's CVE policy. Fix is a
**scoped npm override**:

```json
"express@4": { "path-to-regexp": "0.1.13" }
```

`0.1.13` is patched for the relevant ReDoS CVE and was vetted into the
mirror specifically to unblock this. The flat `path-to-regexp@6.3.0`
override stays for every other consumer in the tree (router, superstatic,
etc.). Don't merge the two — express genuinely needs the 0.1.x callable
shape *and* the 0.1.x route syntax (`:name(*)` custom-pattern form),
neither of which 1.x+ supports.

## Build / test / lint

```
npm install            # install all deps
npm start              # dev server at http://localhost:4200/
npm run build          # dev build
npm run build:prod     # production build (uses environment.prod.ts)
npm run lint           # eslint over src/, functions/src/, types.ts
```

There are no spec files — the karma/jasmine infrastructure was removed
because it was unused. If you add tests, you'll need to re-add the test
runner.

Functions builds with plain `tsc`:

```
cd functions && npm install && npm run build
```

## Codebase conventions

- **No moment, no lodash in `src/`.** Use luxon's `DateTime` for dates and
  native JS (`?.`, `??`, destructuring, `Math.max`) instead of lodash
  helpers. Functions still uses lodash for now.
- **Catch errors that aren't used start with `_`** (`catch (_e) {}`) — the
  ESLint config allows the `^_` prefix to opt out of `no-unused-vars`.
- **Components are non-standalone by default** (`standalone: false` in the
  decorator). Angular 19 defaults to standalone if not specified, but this
  project uses NgModules; adding `standalone: false` keeps it consistent
  with the existing app/page modules.
- **Firebase access is via the modular SDK** (`@angular/fire/firestore`,
  not `@angular/fire/compat/*`). Constraint arrays for queries should be
  typed `QueryConstraint[]` — rxjs 7 + Firebase 11 are strict about this.

## Known modernization next steps

1. **firebase-functions v1 → v2 API migration.** `functions/src/**` still
   uses `firebase-functions/v1` imports (`functions.firestore.document(...)
   .onCreate(...)`). The v2 API (`onDocumentCreated`, etc.) is the modern
   surface and has better cold-start / scaling characteristics. Gen 2
   Cloud Run runtime is also recommended for new functions.

2. **Angular 19 → 21.** The registry's "latest vetted" target is Angular 21.
   Blocked on `@angular/fire@21` being vetted (currently pending). When
   that lands, bumping all `@angular/*` to 21 plus the related toolchain
   (`@angular-devkit/build-angular`, `@angular/cli`, `typescript-eslint` to
   8.59+, `angular-eslint` to 21.x) should remove several of the current
   overrides.

3. **angular-eslint integration.** Right now `npm run lint` only lints
   TypeScript, not Angular templates. After Angular 21 bump, add
   `angular-eslint` (also 21.x) for template linting.

## Things that already exist — don't reinvent

- `greenflagged-feedback.md` (gitignored) — feedback memo with specific
  asks of the greenflagged mirror itself, written from this session's
  experience. Reference if working on related tooling.
