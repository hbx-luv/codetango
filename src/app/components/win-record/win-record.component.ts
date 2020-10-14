import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-win-record',
  templateUrl: './win-record.component.html',
  styleUrls: ['./win-record.component.scss'],
})
export class WinRecordComponent {
  @Input() wins: number;
  @Input() losses: number;

  constructor() {}

  get total(): number {
    return this.wins + this.losses;
  }

  get winsPercent(): string {
    return `${(this.wins / this.total * 100).toFixed(1)}%`;
  }

  get lossesPercent(): string {
    return `${(this.losses / this.total * 100).toFixed(1)}%`;
  }
}
