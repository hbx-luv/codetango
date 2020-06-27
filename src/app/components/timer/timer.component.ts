import { Component, OnInit } from '@angular/core';
import {Observable, Subscription, timer} from 'rxjs';
import { take, map } from 'rxjs/operators';

@Component({
  selector: 'app-timer',
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.scss'],
})
export class TimerComponent implements OnInit {
  countDown: Subscription;
  counter = 120;
  tick = 1000;
  constructor() {}

  ngOnInit() {
    this.countDown = timer(0, this.tick).subscribe(() => --this.counter);
  }
}
