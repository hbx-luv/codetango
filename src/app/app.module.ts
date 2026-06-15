import {NgModule} from '@angular/core';
import {provideFirebaseApp, initializeApp} from '@angular/fire/app';
import {connectAuthEmulator, getAuth, provideAuth} from '@angular/fire/auth';
import {connectFirestoreEmulator, getFirestore, provideFirestore} from '@angular/fire/firestore';
import {getAnalytics, provideAnalytics, ScreenTrackingService, UserTrackingService} from '@angular/fire/analytics';
import {connectFunctionsEmulator, getFunctions, provideFunctions} from '@angular/fire/functions';
import {BrowserModule} from '@angular/platform-browser';
import {RouteReuseStrategy} from '@angular/router';
import {IonicModule, IonicRouteStrategy} from '@ionic/angular';
import {environment} from 'src/environments/environment';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {ServiceWorkerModule} from '@angular/service-worker';

const firebaseProviders = [
  provideFirebaseApp(() => initializeApp(environment.firebase)),
  provideFirestore(() => {
    const fs = getFirestore();
    if (environment.useEmulators && environment.emulators) {
      const {host, port} = environment.emulators.firestore;
      connectFirestoreEmulator(fs, host, port);
    }
    return fs;
  }),
  provideAuth(() => {
    const auth = getAuth();
    if (environment.useEmulators && environment.emulators) {
      connectAuthEmulator(auth, environment.emulators.auth.url, {disableWarnings: true});
    }
    return auth;
  }),
  provideFunctions(() => {
    const fns = getFunctions();
    if (environment.useEmulators && environment.emulators) {
      const {host, port} = environment.emulators.functions;
      connectFunctionsEmulator(fns, host, port);
    }
    return fns;
  }),
];

// Analytics requires a real Firebase project; skip it in emulator mode.
const analyticsProviders = environment.useEmulators ? [] : [
  provideAnalytics(() => getAnalytics()),
  ScreenTrackingService,
  UserTrackingService,
];

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot({mode: 'md'}),
    AppRoutingModule,
    ServiceWorkerModule.register('ngsw-worker.js', {enabled: environment.production}),
  ],
  providers: [
    ...firebaseProviders,
    ...analyticsProviders,
    {provide: RouteReuseStrategy, useClass: IonicRouteStrategy},
  ],
  bootstrap: [
    AppComponent,
  ]
})
export class AppModule {
}
