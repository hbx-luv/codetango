import {Injectable} from '@angular/core';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  Firestore,
  limit,
  orderBy,
  query,
  QueryConstraint,
  startAfter,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Game} from 'types';
import {buildAssetUrlPattern} from '../components/game/tile-util'

@Injectable({providedIn: 'root'})
export class GameService {
  constructor(
      private readonly firestore: Firestore,
  ) {}

  createGame(game: Partial<Game>) {
    const createdAt = Date.now();
    return addDoc(collection(this.firestore, 'games'), {createdAt, ...game});
  }

  updateGame(id: string, game: Partial<any>) {
    return updateDoc(doc(this.firestore, 'games', id), game);
  }

  removePlayerFromGame(gameId: string, userIdToRemove: string) {
    return updateDoc(doc(this.firestore, 'games', gameId), {
      'redTeam.userIds': arrayRemove(userIdToRemove),
      'blueTeam.userIds': arrayRemove(userIdToRemove),
    });
  }

  addPlayerToTeam(
      gameId: string, playerId: string, team: 'redTeam'|'blueTeam') {
    const oppositeTeam = team === 'redTeam' ? 'blueTeam' : 'redTeam';
    return updateDoc(doc(this.firestore, 'games', gameId), {
      [`${team}.userIds`]: arrayUnion(playerId),
      [`${oppositeTeam}.userIds`]: arrayRemove(playerId),
    });
  }

  assignSpymaster(
      gameId: string, playerId: string, team: 'redTeam'|'blueTeam') {
    return updateDoc(doc(this.firestore, 'games', gameId), {
      [`${team}.spymaster`]: playerId,
    });
  }

  getGame(gameId: string): Observable<Game> {
    const ref = doc(this.firestore, 'games', gameId);
    return docData(ref, {idField: 'id'}).pipe(
        map(data => {
          if (!data) {
            return {id: gameId, exists: false} as unknown as Game;
          }
          const game = {...(data as Game), id: gameId, exists: true};
          game.assetUrlPattern = buildAssetUrlPattern(game.gameType);
          return game;
        }),
    ) as Observable<Game>;
  }

  getCurrentGame(roomId: string): Observable<Game|null> {
    const q = query(
        collection(this.firestore, 'games'),
        where('roomId', '==', roomId),
        orderBy('createdAt', 'desc'),
        limit(1),
    );
    return collectionData(q, {idField: 'id'}).pipe(
        map(games => {
          if (!games || !games.length) {
            return null;
          }
          const game = games[0] as Game;
          game.assetUrlPattern = buildAssetUrlPattern(game.gameType);
          return game;
        }),
    );
  }

  getCompletedGames(
      roomId?: string, limitCount?: number, startAfterValue?: number,
      collectionName = 'games'): Observable<Game[]> {
    const constraints: QueryConstraint[] = [orderBy('completedAt', 'desc')];
    if (roomId) {
      constraints.push(where('roomId', '==', roomId));
    }
    if (limitCount) {
      constraints.push(limit(limitCount));
    }
    if (startAfterValue) {
      constraints.push(startAfter(startAfterValue));
    }

    const q = query(collection(this.firestore, collectionName), ...constraints);
    return collectionData(q, {idField: 'id'}).pipe(
        map(games => (games as Game[]).map(game => {
          game.assetUrlPattern = buildAssetUrlPattern(game.gameType);
          return game;
        })),
    ) as Observable<Game[]>;
  }

  getUserGames(userId: string, limitCount?: number): Observable<Game[]> {
    const constraints: QueryConstraint[] = [
      where('userIds', 'array-contains', userId),
      orderBy('completedAt', 'desc'),
    ];
    if (limitCount) {
      constraints.push(limit(limitCount));
    }
    const q = query(collection(this.firestore, 'games'), ...constraints);
    return collectionData(q, {idField: 'id'}).pipe(
        map(games => (games as Game[]).map(game => {
          game.assetUrlPattern = buildAssetUrlPattern(game.gameType);
          return game;
        })),
    ) as Observable<Game[]>;
  }

  deleteGame(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, 'games', id));
  }
}
