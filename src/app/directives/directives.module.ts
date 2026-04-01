import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {RandomBlinkDirective} from './random-blink.directive';
import {TooltipDirective} from './tooltip.directive';

@NgModule({
  declarations: [
    TooltipDirective,
    RandomBlinkDirective,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
  ],
  exports: [
    TooltipDirective,
    RandomBlinkDirective,
  ]
})
export class DirectivesModule {
}
