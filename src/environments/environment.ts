// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
import {version} from '../../package.json';

export const environment = {
  version,
  production: true,
  firebase: {
    apiKey: 'AIzaSyDTncO1ABukAWNm1TROLRVTeW-y8DemgoA',
    authDomain: 'codetango.firebaseapp.com',
    databaseURL: 'https://codetango.firebaseio.com',
    projectId: 'codetango',
    storageBucket: 'codetango.appspot.com',
    messagingSenderId: '552807035418',
    appId: '1:552807035418:web:545b44bf7b7884d7d2d7a3',
    measurementId: 'G-MD21480XBY'
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`,
 * `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a
 * negative impact on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
