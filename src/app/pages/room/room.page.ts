import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable} from 'rxjs';
import {GameService} from 'src/app/services/game.service';
import {RoomService} from 'src/app/services/room.service';
import {Game, Room} from 'types';

@Component({
  selector: 'app-room',
  templateUrl: './room.page.html',
  styleUrls: ['./room.page.scss'],
})
export class RoomPage {
  roomId: string;
  room$: Observable<Room>;
  currentGame$: Observable<Game>;

  constructor(
      private readonly gameService: GameService,
      private readonly roomService: RoomService,
      private readonly route: ActivatedRoute,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.room$ = this.roomService.getRoom(this.roomId);
    this.currentGame$ = this.gameService.getCurrentGame(this.roomId);
  }
}
