import {Component, Input, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {RoomService} from 'src/app/services/room.service';
import {Room} from 'types';

@Component({
  selector: 'app-room-list-item',
  templateUrl: './room-list-item.component.html',
  styleUrls: ['./room-list-item.component.scss'],
})
export class RoomListItemComponent {
  BASE_WIDTH = 75;

  @Input() roomId: string;

  style: {width: string};
  room$: Observable<Room>;

  constructor(
      private readonly roomService: RoomService,
  ) {
    this.style = {width: `${this.getRandomWidth()}px`};
  }

  ngOnInit() {
    this.room$ = this.roomService.getRoom(this.roomId);
  }

  getRandomWidth() {
    return this.BASE_WIDTH + Math.floor(Math.random() * 20) + 1;
  }
}
