import {Component, Input} from '@angular/core';
import {Clue, TeamType} from 'types';

@Component({
  selector: 'app-clue',
  templateUrl: './clue.component.html',
  styleUrls: ['./clue.component.scss'],
})
export class ClueComponent {
  @Input() clue: Clue;
  @Input() showTooltip: boolean;
  @Input() isEmojis: boolean;

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
      case TeamType.BLUE:
        return 'primary';
      case TeamType.RED:
        return 'danger';
      default:
        return '';
    }
  }

  // Receive the code (ie: 1f45d)
  // And create a picture tooltip
  emojiTooltip(emojiWord: string): string {
    return `https://twitter.github.io/twemoji/2/72x72/${emojiWord}.png`;
  }
}
