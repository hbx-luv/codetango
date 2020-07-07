# CodeTango

Codenames Stock Market Index

### Dev setup

Install the Ionic CLI, Angular CLI, and the Firebase CLI:  
`npm install -g @ionic/cli @angular/cli firebase-tools`

Install all the dependencies:  
`npm run update` 

Serve the project:  
`ionic serve`

Ionic Framework docs:  
https://ionicframework.com/docs/components

Firebase Console:  
https://console.firebase.google.com/u/0/project/codetango

Firestore Docs:  
https://firebase.google.com/docs/firestore

### CLI niceties

You can leverage the Ionic CLI for creating pages, components, and services. It uses the Angular CLI under the hood for most of the heavy lifting.

Create a new page:  
`ionic g page "Game Detail"`

Create a new component:  
`ionic g component board`

Create a new service:  
`ionic g service auth`

More options through interactive CLI:
`ionic generate`

### Deploy

You need to run `ionic build` in the root of the project to get the static webapp built for deployment in `www/`. At that point you can just `firebase deploy --only hosting` to deploy just that content. Here are some aliases in the `package.json` and other quick commands:

To run any of the following commands, you'll need to be logged into the Firebase CLI:  
`firebase login`

Deploy everything in one go:  
`npm run deploy`

Deploy hosting separately:  
`npm run deploy-hosting`

Deploy functions seperately:  
`firebase deploy --only functions`  

Or just deploy the `helloWorld` function:  
`firebase deploy --only functions:helloWorld`  

App is hosted at:  
https://codetango.web.app/
