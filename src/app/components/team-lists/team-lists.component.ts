import {Component, Input, OnInit} from '@angular/core';
import {Game} from '../../../../types';

@Component({
  selector: 'app-team-lists',
  templateUrl: './team-lists.component.html',
  styleUrls: ['./team-lists.component.scss'],
})
export class TeamListsComponent implements OnInit {
  @Input() game: Game;



  constructor() { }

  ngOnInit() {
  }

  // TODO: Wasn't sure the best way to conver these ids into their respecctive uesrs so we could diplay their names
  get blueTeam(): string[] {
    if (this.game){
      return this.game.blueTeam.userIds;
    }
    return [];
  }

  get redTeam(): string[] {
    if (this.game){
      return this.game.redTeam.userIds;
    }
    return [];
  }


}
