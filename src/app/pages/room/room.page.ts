import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable} from 'rxjs';
import {RoomService} from 'src/app/services/room.service';
import {Room} from 'types';

@Component({
  selector: 'app-room',
  templateUrl: './room.page.html',
  styleUrls: ['./room.page.scss'],
})
export class RoomPage {
  roomId: string;
  room$: Observable<Room>;

  constructor(
      private readonly roomService: RoomService,
      private readonly route: ActivatedRoute,
  ) {
    this.roomId = this.route.snapshot.paramMap.get('id');
    this.room$ = this.roomService.getRoom(this.roomId);
  }
}
