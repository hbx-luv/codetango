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

  public updateGame(id: string, game: Partial<Game>) {
    return this.afs.collection('games').doc(id).update(game);
  }

  public removePlayerFromGame(gameId: string, userIdToRemove: string) {
    console.log(gameId, userIdToRemove);
    return this.afs.collection('games').doc(gameId).update({
      'redTeam.userIds': firestore.FieldValue.arrayRemove(userIdToRemove),
      'blueTeam.userIds': firestore.FieldValue.arrayRemove(userIdToRemove),
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
