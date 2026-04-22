import {NgModule} from '@angular/core';
import {provideFirebaseApp, initializeApp} from '@angular/fire/app';
import {getAuth, provideAuth} from '@angular/fire/auth';
import {getFirestore, provideFirestore} from '@angular/fire/firestore';
import {getAnalytics, provideAnalytics, ScreenTrackingService, UserTrackingService} from '@angular/fire/analytics';
import {getFunctions, provideFunctions} from '@angular/fire/functions';
import {BrowserModule} from '@angular/platform-browser';
import {RouteReuseStrategy} from '@angular/router';
import {IonicModule, IonicRouteStrategy} from '@ionic/angular';
import {environment} from 'src/environments/environment';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {ServiceWorkerModule} from '@angular/service-worker';

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
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
    provideAnalytics(() => getAnalytics()),
    provideFunctions(() => getFunctions()),
    ScreenTrackingService,
    UserTrackingService,
    {provide: RouteReuseStrategy, useClass: IonicRouteStrategy},
  ],
  bootstrap: [
    AppComponent,
  ]
})
export class AppModule {
}
