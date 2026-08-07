import {Clue, Game, GameStatus, TeamType, Tile, TileRole} from '../../types';

/** 'RED' | 'BLUE' whose turn it is, or null if the game is over / not started. */
export function currentTeam(status: GameStatus): TeamType|null {
  if (status === GameStatus.REDS_TURN) return TeamType.RED;
  if (status === GameStatus.BLUES_TURN) return TeamType.BLUE;
  return null;
}

export function isGameOver(status: GameStatus): boolean {
  return status === GameStatus.RED_WON || status === GameStatus.BLUE_WON;
}

export function teamObj(game: Game, team: TeamType) {
  return team === TeamType.RED ? game.redTeam : game.blueTeam;
}

/**
 * SPYMASTER view: partition the unrevealed board by role, from `team`'s
 * perspective. This deliberately reads tile roles — only ever used to build a
 * spymaster's prompt.
 */
export function partitionBoard(game: Game, team: TeamType) {
  const playerWords: string[] = [];
  const opponentWords: string[] = [];
  const neutralWords: string[] = [];
  let bombWord = '';
  for (const tile of game.tiles || []) {
    if (tile.selected) continue;
    const {word = '', role} = tile;
    if (role === TileRole.ASSASSIN) bombWord = word;
    else if (role === TileRole.CIVILIAN) neutralWords.push(word);
    else if ((role as unknown as TeamType) === team) playerWords.push(word);
    else opponentWords.push(word);
  }
  return {playerWords, opponentWords, neutralWords, bombWord};
}

/**
 * GUESSER view: the ONLY board information a guesser bot is ever given. Roles of
 * UNSELECTED tiles are stripped entirely; a revealed tile keeps its (public)
 * role. This is the structural no-cheating guarantee for guesser bots.
 */
export function guesserView(game: Game) {
  const unrevealed: string[] = [];
  const revealed: string[] = [];
  for (const tile of game.tiles || []) {
    if (tile.selected) revealed.push(`${tile.word} (${tile.role})`);
    else unrevealed.push(tile.word || '');
  }
  return {unrevealed, revealed};
}

/**
 * Server-side replica of the client's getGameStatus (game-board.component.ts).
 * Given a just-revealed tile and the post-decrement agent counts, returns the
 * resulting game status.
 */
export function computeGameStatus(
    game: Game, tile: Tile, clue: Clue, redAgents: number,
    blueAgents: number): GameStatus {
  if (blueAgents === 0) return GameStatus.BLUE_WON;
  if (redAgents === 0) return GameStatus.RED_WON;

  const bluesTurn = game.status === GameStatus.BLUES_TURN;
  const maxReached =
      (clue.guessesMade || []).length + 1 >= clue.maxGuesses;
  switch (tile.role) {
    case TileRole.ASSASSIN:
      return bluesTurn ? GameStatus.RED_WON : GameStatus.BLUE_WON;
    case TileRole.CIVILIAN:
      return bluesTurn ? GameStatus.REDS_TURN : GameStatus.BLUES_TURN;
    case TileRole.BLUE:
      return maxReached && bluesTurn ? GameStatus.REDS_TURN :
                                       GameStatus.BLUES_TURN;
    case TileRole.RED:
      return maxReached && !bluesTurn ? GameStatus.BLUES_TURN :
                                        GameStatus.REDS_TURN;
    default:
      return game.status;
  }
}
