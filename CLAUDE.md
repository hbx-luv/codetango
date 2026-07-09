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

## Dependencies

Both package trees install from **public npm**. There are two `.npmrc`
files and neither sets a custom registry:

```
# .npmrc                 # functions/.npmrc
legacy-peer-deps=true    registry=https://registry.npmjs.com
```

`legacy-peer-deps` is load-bearing at the root — Angular and Ionic
disagree about peer ranges and a strict install fails.

Historically the root `.npmrc` pointed at a private vetted-package mirror
(`greenflagged.dev`). It no longer does, and the `mcp__greenflagged__*`
tools are irrelevant to this repo. If you find a doc, comment, or memory
that says otherwise, it is stale.

**The `overrides` block is small — keep it that way.** `package.json`
carries 1 scoped + 9 flat overrides:

- `path-to-regexp: 6.3.0` — global CVE forward-pin.
- `express@4 → path-to-regexp: 0.1.13` — scoped, unblocks the emulator
  (see "Local emulators" below). Don't merge it into the flat pin.
- `babel-loader: 9.2.1` — peer-mismatch pin; Angular wants 10.
- `debug`, `flat-cache`, `pac-resolver`, `jsesc`, `spdy`, `fresh` —
  transitive pins inherited from the mirror era, when the mirror refused
  the version npm would otherwise have chosen.

That last group may no longer be necessary now that installs come from
public npm. **Don't delete any override without first confirming
`npm install`, `npm run build`, `npm run lint`, and `npm run emulators`
all still pass** — some exist for runtime compat that never surfaces as
an install error. A `Cannot find module '.../package.json' is not
defined by exports` or `X is not a function` at runtime usually means an
override picked an ESM-only version of a CJS-consumed package; pin to
the older CJS-friendly version rather than removing the override.

**Keep `package-lock.json` internally consistent.** `npm ci` reconstructs
the ideal tree from `package.json` and errors if *any* platform-specific
optional dependency it expects is absent from the lock — including
architectures you don't build on. A stale hoisted entry (e.g. a rollup
platform binary left behind from an older resolution) will pass locally
and fail CI with `Missing: <pkg>@<version> from lock file`. `npm install
--package-lock-only` will **not** prune such an orphan; only deleting the
lock and regenerating does, and that re-resolves every semver range, so
verify with lint + `build:prod` afterwards.

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
`6.3.0` (class-based) as a CVE forward-pin. Fix is a
**scoped npm override**:

```json
"express@4": { "path-to-regexp": "0.1.13" }
```

`0.1.13` is patched for the relevant ReDoS CVE. The flat `path-to-regexp@6.3.0`
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

1. **Angular 20 → 21.** Blocked on `@angular/fire`, which tops out at
   20.0.1 (peers `@angular/core@^20.0.0`).
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

- **`functions/src/util/llm/`** — the LLM provider router. Don't call a
  model SDK directly from a function. Call `complete(req, validate,
  chain)` and pass a type guard; the *router* owns `JSON.parse` and
  validation, so a malformed response is treated exactly like a network
  error and falls through to the next provider in `chain`. An exhausted
  chain throws `AllProvidersFailedError`. Chains are per-call-site:
  themed words use `['anthropic', 'openai']`, clue generation uses
  `['anthropic']` alone so a degraded clue can't silently lose a game.
  Providers return raw text and must never swallow an error into a
  sentinel value — that bug once produced empty game boards.

- **Two AI call sites**, both behind the router: themed word-list
  generation (`util/chatgpt.ts`, triggered from `games/onCreate.ts`) and
  spymaster clue generation (`callable/chat-gpt.ts`). The latter is
  authenticated and restricted to the requesting team's spymaster.

- **Known open issue:** `firestore.rules` grants `allow read: if true` on
  `games/{document=**}`, and tile roles live in the game document — so
  the assassin's location is publicly readable straight from Firestore,
  independent of any Cloud Function. Closing that means not shipping
  roles to clients at all. Don't claim a change "fixes the assassin leak"
  while this rule stands.
