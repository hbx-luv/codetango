# CodeTango

[Play codenames now!](https://codetango.web.app/)

[CodeTango](https://codetango.web.app/) is the result of a hackathon at [Tango Card](https://www.tangocard.com/careers/) on 6/26/20 but is still actively being developed. To play, you enter a room code from the home page and are then prompted to log in (if you are not already logged in). You are required to have a Google account to play on [CodeTango](https://codetango.web.app/). Once signed in, and you have enough players to play a game, you can assign teams, pick a spymaster, and begin playing. After each match, statistics are calculated, and you can view these from the leaderboard pages or individual user scorecard pages. You can scroll back through the game history as well to see all completed games that affect your stats. You can also view [all games played on CodeTango here](https://codetango.web.app/all/rooms/games).  

**A completed game:**
![A completed game](https://i.imgur.com/WwOUXJW.png)
**A player's scorecard:**
![A god of a player's scorecard](https://i.imgur.com/lvveQc2.png)

If you have any feedback or suggestions, feel free to create an issue.

If you're a developer interested in contributing, read on:

### Dev setup

Install Node 20 (Functions runtime) or 22 (local dev). Then:

```
npm install
npm start
```

The dev server runs at http://localhost:4200.

`npm start` is **local-only by default** — `src/environments/environment.ts` points the app at the `demo-codetango` Firebase project ID, so the SDK will refuse to talk to a real Firebase backend. Auth, Firestore, and Functions calls all try to reach a local emulator on `127.0.0.1`. This is intentional so an accidental write never lands in prod data.

### Running modes

| Command | What it does | Talks to prod? |
| --- | --- | --- |
| `npm start` | `ng serve` against the demo Firebase config; emulator-bound | No (firewalled) |
| `npm run emulators` | Boots the Firebase emulator suite (auth/firestore/functions/UI) | No |
| `npm run start:emulators` | Starts emulators + `ng serve` together (one Ctrl-C kills both) | No |
| `npm run start:prod-data` | `ng serve` against the **production** Firebase project — explicit opt-in, prints a red warning banner | **Yes** |
| `npm run build` | Dev `ng build` (uses `environment.ts`) | No |
| `npm run build:prod` | Production `ng build` (uses `environment.prod.ts`) | N/A (build output) |
| `npm run lint` | ESLint on `src/`, `functions/src/`, `types.ts` | N/A |

### Vetted package registry

`.npmrc` points npm at `https://greenflagged.dev/npm`, the org's vetted package mirror. Most transitive deps had no satisfying vetted version on the first install — `package.json` has ~90 `overrides` entries that pin each to whatever was both vetted and compatible with the rest of the tree (some pinned forward to drop CVE-tainted versions, some pinned back to the last CJS-friendly release because firebase-tools' internals are CJS).

If a fresh `npm install` ever fails with `ETARGET` (mirror lacks a satisfying version), the registry can usually auto-prioritize the request — re-run `npm install` after ~30 s. For unblocked work, `legacy-peer-deps=true` is on in `.npmrc` for one optional peer (`@angular/fire` → `firebase-tools`).

### CLI niceties

This project uses the Angular CLI directly (no Ionic CLI required):

```
npx ng g page pages/game-detail
npx ng g component components/board
npx ng g service services/auth
```

Ionic Framework docs: https://ionicframework.com/docs/components

Firestore Docs: https://firebase.google.com/docs/firestore

### CI/CD

When a pull request is created (and any future commits are pushed to that branch), a build is kicked off to ensure you didn't break anything. Any push to master (including merged pull requests) will automatically trigger a build + deploy to prod. You can check out this config under `.github/workflows`

### Manual Deploys

First, you'll need to be invited to the [firebase cloud console for this project](https://console.firebase.google.com/u/0/project/codetango) and then login to the cli via `firebase login`.

`npm run build:prod` produces a static webapp in `www/`. `firebase deploy --only hosting -P [env]` ships just that content. The `package.json` has aliases for the common combinations:

```
npm run deploy:dev          # build + deploy everything to dev
npm run deploy:prod         # build + deploy everything to prod
npm run deploy-hosting:dev  # build + deploy only hosting to dev
npm run deploy-hosting:prod # build + deploy only hosting to prod
npm run deploy-functions:dev
npm run deploy-functions:prod
```

To deploy a single cloud function:

```
firebase deploy --only functions:onGameCreate -P dev
firebase deploy --only functions:onGameCreate -P prod
```
