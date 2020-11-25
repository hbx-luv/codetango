import {Component, Input, OnChanges, OnDestroy} from '@angular/core';
import Chart from 'chart.js';
import * as _ from 'lodash';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {EloHistoryService} from 'src/app/services/elo-history.service';

interface EloComparisonMap {
  // each user has map of elo ratings for given days
  [userId: string]: {
    // each key is the number of days back from today. 0 is today, 1 is
    // yesterday, etc. each value is the elo at midnight on that day
    [day: number]: number;
  }
}

@Component({
  selector: 'app-performance-comparison-chart',
  templateUrl: './performance-comparison-chart.html',
  styleUrls: ['./performance-comparison-chart.scss'],
})
export class PerformanceComparisonChartComponent implements OnChanges,
                                                            OnDestroy {
  private destroyed$ = new Subject<void>();

  @Input() users: string[] = [];
  @Input() limit: number = 30;

  chart: any;
  uniqueId: string = _.uniqueId();

  lastDataString = '';

  constructor(
      private readonly eloHistoryService: EloHistoryService,
  ) {}

  ngOnChanges() {
    // always kill the previous observable
    this.destroyed$.next();

    // if there are no users to compare, return
    if (this.users.length === 0) {
      return;
    }

    const map = this.getEloComparisonMap();
  }

  async getEloComparisonMap(): Promise<EloComparisonMap> {
    const performance = {};
    const promises = [];

    for (const userId of this.users) {
      // instantiate empty array
      performance[userId] = {};

      for (let day = 0; day < this.limit; day++) {
        const midnightIDaysAgo = this.eloHistoryService.getMidnight(day);

        promises.push(this.eloHistoryService.getEloAt(midnightIDaysAgo, userId)
                          .then(stats => {
                            performance[userId][day] =
                                stats && stats.elo ? stats.elo : null;
                          }));
      }
    }

    await Promise.all(promises);
    return performance;
  }

  buildPerformanceComparison(map: EloComparisonMap) {
    for (let day = 0; day < this.limit; day++) {
      // TODO: build up some series we can graph that show the performance gain
      // since the first elo rating in the range
    }
  }

  updateChart(dataPoints) {
    // prevent the chart from updating if there is nothing different
    const dataString = JSON.stringify(dataPoints);
    if (this.lastDataString === dataString) {
      return;
    }
    // if this is a new chart, save the data, then continue
    else {
      this.lastDataString = dataString;
    }

    const eloPoints = _.map(dataPoints, 'elo');
    const allTime = !this.limit || this.limit > eloPoints.length;

    this.chart = new Chart('chart-' + this.uniqueId, {
      type: 'line',
      data: {
        labels: _.map(dataPoints, 'date'),
        datasets: [{
          label: 'Elo',
          data: eloPoints,
          backgroundColor: 'rgba(72,138,255,0)',
          borderColor: '#71a8e7',
          borderWidth: 2
        }]
      },
      options: {
        elements: {
          point: {radius: 0},
          line: {tension: 0.3},  // tension: 0 is no curves
        },
        layout: {padding: {left: 0, right: 0, top: 0, bottom: 0}},
        legend: {display: false},
        scales: {
          yAxes: [{
            ticks: {
              maxTicksLimit: 6,
              suggestedMin: _.max(eloPoints),
              suggestedMax: _.max(eloPoints)
            }
          }],
          xAxes: [{gridLines: {display: false}, ticks: {autoSkipPadding: 10}}]
        },
        title: {
          display: true,
          text: allTime ? 'Data from all time' :
                          'Data from the last ' + dataPoints.length + ' games'
        },
        maintainAspectRatio: false
      }
    });
  }

  ngOnDestroy() {
    this.destroyed$.next();
  }
}
