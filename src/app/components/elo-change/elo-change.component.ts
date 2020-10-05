import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-elo-change',
  templateUrl: './elo-change.component.html',
  styleUrls: ['./elo-change.component.scss'],
})
export class EloChangeComponent {
  @Input() change: number;
  trend: string;

  constructor() {}

  ngOnChanges() {
    this.setTrendIcon();
  }

  setTrendIcon() {
    if (this.change > 0) {
      this.trend = 'trending-up';
    } else if (this.change < 0) {
      this.trend = 'trending-down';
    } else {
      this.trend = 'pulse';
    }
  }
}
