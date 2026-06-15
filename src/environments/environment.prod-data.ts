// Opt-in: dev server pointed at PRODUCTION Firebase data. Used by
// `npm run start:prod-data` only. Do not import directly elsewhere.
import {version} from '../../package.json';

export const environment = {
  version,
  production: false,
  useEmulators: false,
  emulators: null,
  firebase: {
    apiKey: 'AIzaSyDTncO1ABukAWNm1TROLRVTeW-y8DemgoA',
    authDomain: 'codetango.firebaseapp.com',
    databaseURL: 'https://codetango.firebaseio.com',
    projectId: 'codetango',
    storageBucket: 'codetango.appspot.com',
    messagingSenderId: '552807035418',
    appId: '1:552807035418:web:545b44bf7b7884d7d2d7a3',
    measurementId: 'G-MD21480XBY',
  },
};
