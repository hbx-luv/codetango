import {Component, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {RoomService} from 'src/app/services/room.service';
import {Room} from 'types';

@Component({
  selector: 'app-room',
  templateUrl: './room.page.html',
  styleUrls: ['./room.page.scss'],
})
export class RoomPage {
  room$: Observable<Room>

  constructor(
      private readonly roomService: RoomService,
  ) {
    const id = 'firstRoom';
    this.room$ = this.roomService.getRoom(id);
  }
}
