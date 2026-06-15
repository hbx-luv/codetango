import {Component, Input, OnChanges, OnDestroy} from '@angular/core';
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import {Subject} from 'rxjs';

let uniqueIdCounter = 0;
import {takeUntil} from 'rxjs/operators';
import {EloHistoryService} from 'src/app/services/elo-history.service';

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Legend,
    Title,
    Tooltip,
    Filler,
);

@Component({
  standalone: false,
  selector: 'app-elo-chart',
  templateUrl: './elo-chart.html',
  styleUrls: ['./elo-chart.scss'],
})
export class EloChartComponent implements OnChanges, OnDestroy {
  private destroyed$ = new Subject<void>();

  @Input() userId: string;
  @Input() limit?: number;
  chart: Chart|undefined;
  uniqueId: string = String(++uniqueIdCounter);

  lastDataString = '';

  constructor(
      private readonly charts: EloHistoryService,
  ) {}

  ngOnChanges() {
    this.destroyed$.next();

    if (this.userId === undefined) {
      return;
    }

    this.charts.getEloHistoryForUser(this.userId, this.limit)
        .pipe(takeUntil(this.destroyed$))
        .subscribe(dataPoints => {
          this.updateChart(dataPoints);
        });
  }

  updateChart(dataPoints: any[]) {
    const dataString = JSON.stringify(dataPoints);
    if (this.lastDataString === dataString) {
      return;
    }
    this.lastDataString = dataString;

    const eloPoints: number[] = dataPoints.map(d => d.elo);
    const allTime = !this.limit || this.limit > eloPoints.length;

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart('chart-' + this.uniqueId, {
      type: 'line',
      data: {
        labels: dataPoints.map(d => d.date),
        datasets: [{
          label: 'Elo',
          data: eloPoints,
          backgroundColor: 'rgba(72,138,255,0)',
          borderColor: '#71a8e7',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
        }],
      },
      options: {
        layout: {padding: {left: 0, right: 0, top: 0, bottom: 0}},
        plugins: {
          legend: {display: false},
          title: {
            display: true,
            text: allTime ? 'Data from all time' :
                            'Data from the last ' + dataPoints.length +
                                ' games',
          },
        },
        scales: {
          y: {
            ticks: {
              maxTicksLimit: 6,
            },
            suggestedMin: Math.max(...eloPoints),
            suggestedMax: Math.max(...eloPoints),
          },
          x: {
            grid: {display: false},
            ticks: {autoSkipPadding: 10},
          },
        },
        maintainAspectRatio: false,
      },
    });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
