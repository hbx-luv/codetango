import {NgModule} from '@angular/core';
import {AngularFireModule} from '@angular/fire';
import {AngularFireAuthModule} from '@angular/fire/auth';
import {AngularFirestoreModule} from '@angular/fire/firestore';
import {AngularFireAnalyticsModule, ScreenTrackingService, UserTrackingService} from '@angular/fire/analytics';
import {AngularFireFunctionsModule} from '@angular/fire/functions';
import {BrowserModule} from '@angular/platform-browser';
import {RouteReuseStrategy} from '@angular/router';
import {SplashScreen} from '@ionic-native/splash-screen/ngx';
import {StatusBar} from '@ionic-native/status-bar/ngx';
import {IonicModule, IonicRouteStrategy} from '@ionic/angular';
import {environment} from 'src/environments/environment';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import { ServiceWorkerModule } from '@angular/service-worker';

@NgModule({
  declarations: [
    AppComponent,
  ],
  entryComponents: [],
  imports: [
    BrowserModule,
    IonicModule.forRoot({mode: 'md'}),
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireAnalyticsModule,
    AngularFireFunctionsModule,
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }),
  ],
  providers: [
    ScreenTrackingService,
    UserTrackingService,
    StatusBar,
    SplashScreen,
    {provide: RouteReuseStrategy, useClass: IonicRouteStrategy},
  ],
  bootstrap: [
    AppComponent,
  ]
})
export class AppModule {
}
