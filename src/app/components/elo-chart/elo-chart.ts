import {Component, Input, OnChanges, OnDestroy} from '@angular/core';
import Chart from 'chart.js';
import * as _ from 'lodash';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {EloHistoryService} from 'src/app/services/elo-history.service';

@Component({
  selector: 'app-elo-chart',
  templateUrl: './elo-chart.html',
  styleUrls: ['./elo-chart.scss'],
})
export class EloChartComponent implements OnChanges, OnDestroy {
  private destroyed$ = new Subject<void>();

  @Input() userId: string;
  @Input() limit?: number;
  chart: any;
  uniqueId: string = _.uniqueId();

  lastDataString = '';

  constructor(
      private readonly charts: EloHistoryService,
  ) {}

  ngOnChanges() {
    // always kill the previous observable
    this.destroyed$.next();

    // if the id is undefined, return
    if (this.userId === undefined) {
      return;
    }

    // subscribe to this player's elo history and update the chart whenever that
    // changes
    this.charts.getEloHistoryForUser(this.userId, this.limit)
        .pipe(takeUntil(this.destroyed$))
        .subscribe(dataPoints => {
          this.updateChart(dataPoints);
        });
  }

  updateChart(dataPoints) {
    // prevent the chart from updating if there is nothing different
    let dataString = JSON.stringify(dataPoints);
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
