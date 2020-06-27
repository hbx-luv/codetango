import {Component, Input} from '@angular/core';
import {Game} from '../../../../types';

@Component({
  selector: 'app-team-lists',
  templateUrl: './team-lists.component.html',
  styleUrls: ['./team-lists.component.scss'],
})
export class TeamListsComponent {
  @Input() game: Game;

  constructor() {}
}
