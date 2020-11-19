import {Component} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
  selector: 'app-compare',
  templateUrl: './compare.page.html',
  styleUrls: ['./compare.page.scss'],
})
export class ComparePage {
  // userIds for players to compare
  first: string;
  second: string;

  userIds: string[];

  constructor(
      private readonly route: ActivatedRoute,
      private readonly router: Router,
  ) {
    this.first = this.route.snapshot.paramMap.get('first');
    this.second = this.route.snapshot.paramMap.get('second');
    this.userIds = [this.first, this.second];
  }
}
