import {Component, Input, OnInit} from '@angular/core';
import {ModalController} from '@ionic/angular';
import {firstValueFrom} from 'rxjs';
import {take} from 'rxjs/operators';
import {ClueService} from 'src/app/services/clue.service';
import {EloHistoryService} from 'src/app/services/elo-history.service';
import {Clue, Game, GameStatus, TeamType, TileRole} from 'types';

// mirrors BASE_ELO in functions/src/util/elo.ts
const BASE_ELO = 1200;

export interface PlayerStats {
  userId: string;
  team: TeamType;
  isSpymaster: boolean;
  guesses: number;
  correct: number;
  civilians: number;
  enemy: number;
  assassin: number;
  darts: number;
  eloDelta?: number;
}

export interface TeamSummary {
  team: TeamType;
  label: string;
  cssClass: 'blue'|'red';
  found: number;
  total: number;
  cluesGiven: number;
  guesses: number;
  correct: number;
  accuracyPct: number;
  players: PlayerStats[];
}

export interface SpymasterStats {
  userId: string;
  team: TeamType;
  cssClass: 'blue'|'red';
  cluesGiven: number;
  avgClueSize?: string;
  correct: number;
  guesses: number;
  accuracyPct?: number;
  perfectClues: number;
  bestClue?: {word: string, correct: number};
}

export interface Round {
  clue: Clue;
  durationText?: string;
}

export interface Award {
  emoji: string;
  title: string;
  userId: string;
  detail: string;
}

@Component({
  standalone: false,
  selector: 'app-game-stats',
  templateUrl: './game-stats.component.html',
  styleUrls: ['./game-stats.component.scss'],
})
export class GameStatsComponent implements OnInit {
  @Input() game: Game;

  loading = true;
  clues: Clue[] = [];
  rounds: Round[] = [];
  teamSummaries: TeamSummary[] = [];
  spymasters: SpymasterStats[] = [];
  awards: Award[] = [];
  totalGuesses = 0;

  constructor(
      private readonly modalCtrl: ModalController,
      private readonly clueService: ClueService,
      private readonly eloHistoryService: EloHistoryService,
  ) {}

  async ngOnInit() {
    const clues = await firstValueFrom(
        this.clueService.getClues(this.game.id).pipe(take(1)));

    // getClues returns newest first; the stats read chronologically
    this.clues = (clues ?? []).slice().reverse();
    this.buildStats();
    this.loading = false;

    // elo deltas trickle in afterwards, the table updates in place
    this.loadEloChanges();
  }

  get blueWon(): boolean {
    return this.game.status === GameStatus.BLUE_WON;
  }

  get winningTeam(): TeamType {
    return this.blueWon ? TeamType.BLUE : TeamType.RED;
  }

  // when both teams still have agents on the board, the assassin ended it
  get endedByAssassin(): boolean {
    return this.game.blueAgents > 0 && this.game.redAgents > 0;
  }

  get gameDurationText(): string {
    return this.formatDuration(this.game.completedAt - this.game.createdAt);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  private buildStats() {
    const players = new Map<string, PlayerStats>();
    const addTeam = (team: TeamType, userIds: string[], spymaster?: string) => {
      for (const userId of userIds) {
        players.set(userId, {
          userId,
          team,
          isSpymaster: userId === spymaster,
          guesses: 0,
          correct: 0,
          civilians: 0,
          enemy: 0,
          assassin: 0,
          darts: 0,
        });
      }
    };
    addTeam(
        TeamType.BLUE, this.game.blueTeam.userIds,
        this.game.blueTeam.spymaster);
    addTeam(
        TeamType.RED, this.game.redTeam.userIds, this.game.redTeam.spymaster);

    // tally every guess from every clue
    for (const clue of this.clues) {
      for (const tile of clue.guessesMade ?? []) {
        this.totalGuesses++;
        const player = players.get(tile.selectedBy);
        if (!player) {
          continue;
        }
        player.guesses++;
        if (tile.dartedBy) {
          player.darts++;
        }
        if ((tile.role as string) === (clue.team as string)) {
          player.correct++;
        } else if (tile.role === TileRole.CIVILIAN) {
          player.civilians++;
        } else if (tile.role === TileRole.ASSASSIN) {
          player.assassin++;
        } else {
          player.enemy++;
        }
      }
    }

    this.buildRounds();
    this.buildTeamSummaries(players);
    this.buildSpymasterStats();
    this.buildAwards(players);
  }

  private buildRounds() {
    this.rounds = this.clues.map((clue, i) => {
      const end = i + 1 < this.clues.length ? this.clues[i + 1].createdAt :
                                              this.game.completedAt;
      return {clue, durationText: this.formatDuration(end - clue.createdAt)};
    });
  }

  private buildTeamSummaries(players: Map<string, PlayerStats>) {
    const tiles = this.game.tiles ?? [];
    this.teamSummaries = [TeamType.BLUE, TeamType.RED].map(team => {
      const blue = team === TeamType.BLUE;
      const teamPlayers =
          [...players.values()]
              .filter(p => p.team === team)
              .sort(
                  (a, b) => Number(b.isSpymaster) - Number(a.isSpymaster) ||
                      b.guesses - a.guesses);
      const teamClues = this.clues.filter(c => (c.team as string) === team);
      const guesses = teamClues.reduce(
          (sum, c) => sum + (c.guessesMade?.length ?? 0), 0);
      const correct = teamClues.reduce(
          (sum, c) => sum + this.correctGuesses(c), 0);
      const total =
          tiles.filter(t => (t.role as string) === (team as string)).length;
      return {
        team,
        label: blue ? 'Blue Team' : 'Red Team',
        cssClass: blue ? 'blue' as const : 'red' as const,
        found: total -
            (blue ? this.game.blueAgents : this.game.redAgents),
        total,
        cluesGiven: teamClues.length,
        guesses,
        correct,
        accuracyPct: guesses ? Math.round(correct / guesses * 100) : 0,
        players: teamPlayers,
      };
    });
  }

  private buildSpymasterStats() {
    this.spymasters = [];
    for (const team of [TeamType.BLUE, TeamType.RED]) {
      const blue = team === TeamType.BLUE;
      const userId = blue ? this.game.blueTeam.spymaster :
                            this.game.redTeam.spymaster;
      if (!userId) {
        continue;
      }
      const teamClues = this.clues.filter(c => (c.team as string) === team);
      const guesses = teamClues.reduce(
          (sum, c) => sum + (c.guessesMade?.length ?? 0), 0);
      const correct = teamClues.reduce(
          (sum, c) => sum + this.correctGuesses(c), 0);

      // average intended clue size, skipping non-numeric counts like ∞
      const numericCounts = teamClues.map(c => parseInt(c.guessCount, 10))
                                .filter(n => !isNaN(n) && n > 0);
      const avg = numericCounts.length ?
          numericCounts.reduce((a, b) => a + b, 0) / numericCounts.length :
          undefined;

      let bestClue: {word: string, correct: number};
      for (const clue of teamClues) {
        const clueCorrect = this.correctGuesses(clue);
        if (clueCorrect > 0 && clueCorrect > (bestClue?.correct ?? 0)) {
          bestClue = {word: clue.word, correct: clueCorrect};
        }
      }

      this.spymasters.push({
        userId,
        team,
        cssClass: blue ? 'blue' : 'red',
        cluesGiven: teamClues.length,
        avgClueSize: avg !== undefined ? avg.toFixed(1) : undefined,
        correct,
        guesses,
        accuracyPct: guesses ? Math.round(correct / guesses * 100) : undefined,
        perfectClues: teamClues.filter(c => this.isPerfect(c)).length,
        bestClue,
      });
    }
  }

  private buildAwards(players: Map<string, PlayerStats>) {
    this.awards = [];
    const all = [...players.values()];
    const maxBy = (candidates: PlayerStats[], value: (p: PlayerStats) => number,
                   min: number) => {
      let best: PlayerStats;
      for (const candidate of candidates) {
        if (!best || value(candidate) > value(best)) {
          best = candidate;
        }
      }
      return best && value(best) >= min ? best : undefined;
    };

    // winning guess, unless the other team handed it over via the assassin
    const lastClue = this.clues[this.clues.length - 1];
    const lastGuess =
        lastClue?.guessesMade?.[lastClue.guessesMade.length - 1];
    if (!this.endedByAssassin && lastGuess &&
        (lastClue.team as string) === (this.winningTeam as string) &&
        (lastGuess.role as string) === (this.winningTeam as string) &&
        players.has(lastGuess.selectedBy)) {
      this.awards.push({
        emoji: '🏆',
        title: 'Clutch',
        userId: lastGuess.selectedBy,
        detail: `won the game on ${this.tileName(lastGuess.word)}`,
      });
    }

    const sharpshooter = maxBy(
        all.filter(p => p.guesses >= 2),
        p => p.correct / p.guesses * 1000 + p.correct, 0);
    if (sharpshooter && sharpshooter.correct > 0) {
      this.awards.push({
        emoji: '🎯',
        title: 'Sharpshooter',
        userId: sharpshooter.userId,
        detail: `${sharpshooter.correct}/${
            sharpshooter.guesses} guesses correct`,
      });
    }

    const busiest = maxBy(all, p => p.guesses, 3);
    if (busiest) {
      this.awards.push({
        emoji: '🖱️',
        title: 'Trigger Happy',
        userId: busiest.userId,
        detail: `made ${busiest.guesses} guesses`,
      });
    }

    const bestSpymasterClue = this.spymasters.filter(s => s.bestClue)
                                  .sort(
                                      (a, b) => b.bestClue.correct -
                                          a.bestClue.correct)[0];
    if (bestSpymasterClue?.bestClue.correct >= 3) {
      this.awards.push({
        emoji: '🧠',
        title: 'Galaxy Brain',
        userId: bestSpymasterClue.userId,
        detail: `"${bestSpymasterClue.bestClue.word}" found ${
            bestSpymasterClue.bestClue.correct} agents`,
      });
    }

    const civilianMagnet = maxBy(all, p => p.civilians, 2);
    if (civilianMagnet) {
      this.awards.push({
        emoji: '🙈',
        title: 'Civilian Magnet',
        userId: civilianMagnet.userId,
        detail: `bumped into ${civilianMagnet.civilians} civilians`,
      });
    }

    const doubleAgent = maxBy(all, p => p.enemy, 1);
    if (doubleAgent) {
      this.awards.push({
        emoji: '🎁',
        title: 'Double Agent',
        userId: doubleAgent.userId,
        detail: `revealed ${doubleAgent.enemy} enemy agent${
            doubleAgent.enemy > 1 ? 's' : ''}`,
      });
    }

    const assassinVictim = all.find(p => p.assassin > 0);
    if (assassinVictim) {
      this.awards.push({
        emoji: '💀',
        title: 'Fatal Touch',
        userId: assassinVictim.userId,
        detail: 'found the assassin the hard way',
      });
    }

    const dartChampion = maxBy(all, p => p.darts, 1);
    if (dartChampion) {
      this.awards.push({
        emoji: '🎪',
        title: 'Dart Devil',
        userId: dartChampion.userId,
        detail: `threw ${dartChampion.darts} dart${
            dartChampion.darts > 1 ? 's' : ''}`,
      });
    }
  }

  private async loadEloChanges() {
    try {
      const stats = await this.eloHistoryService.getStatsForGame(this.game.id);
      await Promise.all(stats.map(async stat => {
        const before =
            await this.eloHistoryService.getEloAt(stat.timestamp - 1,
                                                  stat.userId);
        const player = this.teamSummaries.flatMap(t => t.players)
                           .find(p => p.userId === stat.userId);
        if (player) {
          player.eloDelta = Math.round(stat.elo - (before?.elo ?? BASE_ELO));
        }
      }));
    } catch (_e) {
      // elo deltas are a nice-to-have; leave the column blank on failure
    }
  }

  private correctGuesses(clue: Clue): number {
    return (clue.guessesMade ?? [])
        .filter(tile => (tile.role as string) === (clue.team as string))
        .length;
  }

  // a perfect clue: every intended guess was made and every one was correct
  private isPerfect(clue: Clue): boolean {
    const intended = parseInt(clue.guessCount, 10);
    const guesses = clue.guessesMade ?? [];
    return !isNaN(intended) && intended > 0 && guesses.length === intended &&
        this.correctGuesses(clue) === intended;
  }

  // picture-based games have no tile word to name the winning tile
  private tileName(word?: string): string {
    return word ? `"${word.toUpperCase()}"` : 'the last tile';
  }

  formatDuration(ms: number): string {
    if (!ms || ms < 0 || isNaN(ms)) {
      return '';
    }
    const totalSeconds = Math.round(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }
}
