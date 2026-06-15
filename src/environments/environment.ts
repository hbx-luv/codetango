// Default development environment — never connects to production.
// Uses the Firebase emulator suite started by `npm start`.
// To intentionally develop against production data, run `npm run start:prod-data`.
import {version} from '../../package.json';

export const environment = {
  version,
  production: false,
  useEmulators: true,
  emulators: {
    firestore: {host: '127.0.0.1', port: 8090},
    auth: {url: 'http://127.0.0.1:9099'},
    functions: {host: '127.0.0.1', port: 5001},
  },
  // Demo-only Firebase config — projectId prefixed with `demo-` so the SDK
  // refuses to talk to a real Firebase backend even if emulator connect fails.
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'localhost',
    projectId: 'demo-codetango',
    storageBucket: 'demo-codetango.appspot.com',
    messagingSenderId: '0',
    appId: '1:0:web:demo',
  },
};
