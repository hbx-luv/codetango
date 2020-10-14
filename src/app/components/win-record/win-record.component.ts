import {Component, Input} from '@angular/core';
import {UserToUserStats} from 'types';

@Component({
  selector: 'app-win-record',
  templateUrl: './win-record.component.html',
  styleUrls: ['./win-record.component.scss'],
})
export class WinRecordComponent {
  @Input() record: UserToUserStats;

  constructor() {}

  ngOnChanges() {
    console.log(this.record);
  }

  get winsPercent(): string {
    return `${
        (this.record.wonAgainst / this.record.totalAgainst * 100).toFixed(1)}%`;
  }

  get lossesPercent(): string {
    return `${
        ((this.record.totalAgainst - this.record.wonAgainst) /
         this.record.totalAgainst * 100)
            .toFixed(1)}%`;
  }
}
