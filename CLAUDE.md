# CLAUDE.md

Notes for agents working in this repo. Skip the parts that don't apply to your task.

## What this repo is

CodeTango — a Codenames-style web game. Ionic + Angular frontend, Firebase
Auth/Firestore/Functions backend, deployed at https://codetango.web.app/.
Originally a hackathon project, still actively developed.

- Frontend: `src/` (Angular 20.3, Ionic 8, RxJS 7, chart.js 4)
- Cloud Functions: `functions/src/` (Firebase Functions 7 v2 API, Node 20)
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

1. **The `overrides` block is small and principled — keep it that way.**
   `package.json` carries 1 scoped + 9 flat overrides. Each one is there
   for an explicit reason: a global CVE forward-pin
   (`path-to-regexp: 6.3.0`), a scoped emulator unblock
   (`express@4 → path-to-regexp: 0.1.13`), a peer-mismatch pin
   (`babel-loader: 9.2.1` — Angular wants 10, mirror tops at 9), or a
   transitive whose desired version was rejected/needs_review by the
   mirror (`debug`, `flat-cache`, `pac-resolver`, `jsesc`, `spdy`,
   `fresh`). **Don't add a new override without first trying
   `mcp__greenflagged__request_package`** — most clean transitive
   versions auto-vet within seconds, and growing the mirror's vetted set
   is preferred over papering over with a pin. **Don't delete an
   existing override without first confirming `npm install`,
   `npm run build`, `npm run lint`, and `npm run emulators` all still
   pass** — some overrides exist for runtime compat that doesn't show up
   as an install error.

2. **`npm install` from scratch may fail** if the mirror's vetted set
   doesn't match `package.json`'s declared versions. The remedy depends on
   what's missing:

   - **ETARGET** (version not in range): the requested version isn't
     vetted. Call `mcp__greenflagged__request_package` with the exact
     version from the error message, then
     `mcp__greenflagged__check_package` to confirm it lands. Most clean
     packages auto-vet in seconds. If the mirror returns
     `needs_review` / `pending` / `rejected`, pin the version to whatever
     the mirror has (highest vetted) via an override and document it.
   - **E404** (package not in mirror): same path —
     `mcp__greenflagged__request_package`. The mirror's auto-prioritize
     handles both E404 and ETARGET.
   - **Runtime TypeError** (`X is not a function`, `Cannot find module
     '...../package.json' is not defined by exports`): the override picked
     an ESM-only version of a CJS-consumed package. Find the older
     CJS-friendly version and pin to that instead.

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
  decorator). Angular 20 defaults to standalone if not specified, but this
  project uses NgModules; adding `standalone: false` keeps it consistent
  with the existing app/page modules.
- **Firebase access is via the modular SDK** (`@angular/fire/firestore`,
  not `@angular/fire/compat/*`). Constraint arrays for queries should be
  typed `QueryConstraint[]` — rxjs 7 + Firebase 11 are strict about this.

## Known modernization next steps

1. **Angular 20 → 21.** The registry has Angular 21 vetted but
   `@angular/fire` tops out at 20.0.1 (peers `@angular/core@^20.0.0`).
   When `@angular/fire@21` lands, bump all `@angular/*` to 21 plus the
   toolchain (`@angular-devkit/build-angular`, `@angular/cli`,
   `angular-eslint` to 21.x). Note that angular-eslint@21 also peers
   `@angular/cli >= 21`, so this bump goes hand-in-hand.

2. **inject() migration.** Angular 20 prefers the `inject()` function
   over constructor parameter DI; `@angular-eslint/prefer-inject` flags
   91 such sites across the services and components. Rule is currently
   off in `eslint.config.mjs`. Use `ng generate @angular/core:inject`
   to auto-migrate when ready, then re-enable the rule.

## Things that already exist — don't reinvent

- `greenflagged-feedback.md` (gitignored) — feedback memo with specific
  asks of the greenflagged mirror itself, written from this session's
  experience. Reference if working on related tooling.
