import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {IonicModule} from '@ionic/angular';
import {TooltipDirective} from './tooltip.directive';

@NgModule({
  declarations: [
    TooltipDirective,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
  ],
  exports: [
    TooltipDirective,
  ]
})
export class DirectivesModule {
}
