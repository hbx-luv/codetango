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
    return this.afs.collection('games').add(game);
  }

  updateGame(id: string, game: Partial<Game>) {
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
    return this.afs.collection('games').doc(gameId).update({
      [`${team}.userIds`]: firestore.FieldValue.arrayUnion(playerId),
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
                  .orderBy('createdAt')
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
}
