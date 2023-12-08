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

Install Node 16.x.

Install the Ionic CLI, Angular CLI, and the Firebase CLI:  
`npm install -g @ionic/cli @angular/cli firebase-tools`

Install all the dependencies:  
`npm run update` 

Serve the project:  
`ionic serve`

Ionic Framework docs:  
https://ionicframework.com/docs/components

Firestore Docs:  
https://firebase.google.com/docs/firestore

### CLI niceties

You can leverage the Ionic CLI for creating pages, components, and services. It uses the Angular CLI under the hood for most of the heavy lifting.

Create a new page:  
`ionic g page "pages/Game Detail"`

Create a new component:  
`ionic g component components/board`

Create a new service:  
`ionic g service services/auth`

More options through interactive CLI:
`ionic generate`

### CI/CD

When a pull request is created (and any future commits are pushed to that branch), a build is kicked off to ensure you didn't break anything. Any push to master (including merged pull requests) will automatically trigger a build + deploy to prod. You can check out this config under `.github/workflows`

### Manual Deploys

First, you'll need to be invited to the [firebase cloud console for this project](https://console.firebase.google.com/u/0/project/codetango) and then login to the cli via `firebase login`.

You need to run `ionic build` in the root of the project to get the static webapp built for deployment in `www/`. At that point you can just `firebase deploy --only hosting -P [env]` to deploy just that content. Here are some aliases in the `package.json` and other quick commands:

You can deploy to either the `dev` database or the `prod` database. By default, when serving the application, it uses the `dev` project, so we don't mess with `prod` data. These configurations are stored in `environment.ts` and `environment.prod.ts`

Deploy everything in one go:  
`npm run deploy:dev`  
`npm run deploy:prod`  

Deploy hosting separately:  
`npm run deploy-hosting:dev`  
`npm run deploy-hosting:prod`  

Deploy functions separately:  
`firebase deploy --only functions -P dev`  
`firebase deploy --only functions -P prod`  

Or just deploy a single cloud function like so:  
`firebase deploy --only functions:onGameCreate -P dev`  
`firebase deploy --only functions:onGameCreate -P prod`  
