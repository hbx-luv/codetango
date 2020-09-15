import {Component, Input} from '@angular/core';
import {Clue, TeamTypes} from 'types';

@Component({
  selector: 'app-clue',
  templateUrl: './clue.component.html',
  styleUrls: ['./clue.component.scss'],
})
export class ClueComponent {
  @Input() clue: Clue;
  @Input() showTooltip: boolean;

  constructor() {}

  /**
   * Return the Ionic color to render as the background of a given clue
   * TODO: maybe consolidate with getColor from word history?
   */
  get color(): string {
    if (!this.clue) {
      return null;
    }
    switch (this.clue.team) {
      case TeamTypes.BLUE:
        return 'primary';
      case TeamTypes.RED:
        return 'danger';
      default:
        return '';
    }
  }
}
