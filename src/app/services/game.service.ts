import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {default as firebase} from 'firebase';
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
      'redTeam.userIds': firebase.firestore.FieldValue.arrayRemove(userIdToRemove),
      'blueTeam.userIds': firebase.firestore.FieldValue.arrayRemove(userIdToRemove),
    });
  }

  addPlayerToTeam(
      gameId: string, playerId: string, team: 'redTeam'|'blueTeam') {
    const oppositeTeam = team === 'redTeam' ? 'blueTeam' : 'redTeam';
    return this.afs.collection('games').doc(gameId).update({
      [`${team}.userIds`]: firebase.firestore.FieldValue.arrayUnion(playerId),
      [`${oppositeTeam}.userIds`]: firebase.firestore.FieldValue.arrayRemove(playerId),
    });
  }

  assignSpymaster(
      gameId: string, playerId: string, team: 'redTeam'|'blueTeam') {
    return this.afs.collection('games').doc(gameId).update({
      [`${team}.spymaster`]: playerId,
    });
  }

  getGame(gameId: string): Observable<Game> {
    return this.afs.collection('games')
        .doc<Game>(gameId)
        .snapshotChanges()
        .pipe(map(game => {
          return {id: game.payload.id, exists: game.payload.exists, ...game.payload.data()};
        }));
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

  getCompletedGames(roomId?: string, limit?: number, startAfter?: number, collection = 'games'):
      Observable<Game[]> {
    return this.afs
        .collection<Game>(
            collection,
            ref => {
              let query = ref.orderBy('completedAt', 'desc');

              // filter by given room
              if (roomId) {
                query = query.where('roomId', '==', roomId);
              }

              // support limiting
              if (limit) {
                query = query.limit(limit);
              }

              // start after a given completedAt timestamp
              if (startAfter) {
                query = query.startAfter(startAfter);
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

  getUserGames(userId: string, limit?: number): Observable<Game[]> {
    return this.afs
        .collection<Game>(
            'games',
            ref => {
              let query = ref.where('userIds', 'array-contains', userId)
                              .orderBy('completedAt', 'desc');

              // support limiting
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
