import * as functions from "firebase-functions";
import {Game, GameStatus, User} from '../../../types';
import * as admin from "firebase-admin";

const db = admin.firestore();

export const onUpdateGame =
    functions.firestore.document('games/{gameId}')
        .onUpdate(async (gameDoc, context) => {
            const preGameUpdate = gameDoc.before.data() as Game;
            const postGameUpdate = gameDoc.after.data() as Game;

            //Check if we the last update was setting the gamestatus to over.
            if (preGameUpdate.status !== postGameUpdate.status && (
                postGameUpdate.status === GameStatus.BLUE_WON || postGameUpdate.status === GameStatus.RED_WON
            )) {
                //Process Endgame analytics
                const gameId = postGameUpdate.id ? postGameUpdate.id : '';
                for(const user of postGameUpdate.blueTeam.userIds){
                    await calculatePlayerStats(user, postGameUpdate.status === GameStatus.BLUE_WON, gameId);
                }
                for(const user of postGameUpdate.redTeam.userIds){
                    await calculatePlayerStats(user, postGameUpdate.status === GameStatus.RED_WON, gameId);
                }
            }
            return 'Done'
        });

async function calculatePlayerStats(userId: string, wonGame: Boolean, gameId: string) {
    const userSnapshot = await db.collection('users').doc(userId);
    let playerUpdate;
    if (wonGame) {
        playerUpdate = {
            'stats.currentStreak': admin.firestore.FieldValue.increment(1),
            'stats.gamesWon': admin.firestore.FieldValue.increment(1),
            'stats.gamesPlayed': admin.firestore.FieldValue.increment(1)
        } ;
    } else {
        playerUpdate = {
            'stats.currentStreak': 0,
            'stats.gamesWon': admin.firestore.FieldValue.increment(0),
            'stats.gamesPlayed': admin.firestore.FieldValue.increment(1)
        };
    }
    userSnapshot.update(playerUpdate)
    const user = (await userSnapshot.get()).data() as User;

    const currentElo = {
        elo: 0, //TODO
        gameId,
        gamesPlayed: user.stats.gamesPlayed,
        gamesWon: user.stats.gamesWon,
        playerId: user.id,
        provisional: false
    };

    const eloSnapshot = await db.collection('elohistory').doc('default');

    return eloSnapshot.create(currentElo);
}
