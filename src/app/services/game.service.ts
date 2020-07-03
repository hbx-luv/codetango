import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {firestore} from 'firebase';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {Game} from 'types';

@Injectable({providedIn: 'root'})
export class GameService {
  constructor(
      private readonly afs: AngularFirestore,
  ) {}

  createGame(game: Partial<Game>) {
    const createdAt = Date.now();
    return this.afs.collection('games').add({createdAt, ...game});
  }

  updateGame(id: string, game: Partial<any>) {
    return this.afs.collection('games').doc(id).update(game);
  }

  removePlayerFromGame(gameId: string, userIdToRemove: string) {
    return this.afs.collection('games').doc(gameId).update({
      'redTeam.userIds': firestore.FieldValue.arrayRemove(userIdToRemove),
      'blueTeam.userIds': firestore.FieldValue.arrayRemove(userIdToRemove),
    });
  }

  addPlayerToTeam(
      gameId: string, playerId: string, team: 'redTeam'|'blueTeam') {
    const oppositeTeam = team === 'redTeam' ? 'blueTeam' : 'redTeam';
    return this.afs.collection('games').doc(gameId).update({
      [`${team}.userIds`]: firestore.FieldValue.arrayUnion(playerId),
      [`${oppositeTeam}.userIds`]: firestore.FieldValue.arrayRemove(playerId),
    });
  }

  assignSpymaster(
      gameId: string, playerId: string, team: 'redTeam'|'blueTeam') {
    return this.afs.collection('games').doc(gameId).update({
      [`${team}.spymaster`]: playerId,
    });
  }

  getCurrentGame(roomId: string): Observable<Game|null> {
    return this.afs
        .collection<Game>(
            'games',
            ref => {
              return ref.where('roomId', '==', roomId)
                  .orderBy('createdAt', 'desc')
                  .limit(1);
            })
        .snapshotChanges()
        .pipe(map(games => {
          if (!games || !games.length) {
            return null;
          }

          const {doc} = games[0].payload;
          return {id: doc.id, ...doc.data()};
        }));
  }

  getCompletedGames(roomId: string, limit?: number): Observable<Game[]> {
    return this.afs
        .collection<Game>(
            'games',
            ref => {
              let query = ref.where('roomId', '==', roomId)
                              .orderBy('completedAt', 'desc');

              if (limit) {
                query = query.limit(limit);
              }

              return query;
            })
        .snapshotChanges()
        .pipe(map(actions => {
          return actions.map(action => {
            const {doc} = action.payload;
            return {id: doc.id, ...doc.data()};
          });
        }));
  }

  deleteGame(id: string): Promise<void> {
    return this.afs.collection('games').doc(id).delete();
  }
}
