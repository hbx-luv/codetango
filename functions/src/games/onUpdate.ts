import * as functions from "firebase-functions";
import {Game, GameStatus} from "../../../types";
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
                console.log("GAME OVER:" + postGameUpdate.status)
                //Process Endgame analytics
                for(const user of postGameUpdate.blueTeam.userIds){
                    await calculatePlayerStats(user, postGameUpdate.status === GameStatus.BLUE_WON);
                }
                for(const user of postGameUpdate.redTeam.userIds){
                    await calculatePlayerStats(user, postGameUpdate.status === GameStatus.RED_WON);
                }
            }
            return 'Done'
        });

async function calculatePlayerStats(userId: string, wonGame: Boolean) {
    const userSnapshot = await db.collection('users').doc(userId);
    let statUpdate;
    if (wonGame) {
        statUpdate = { stats: {
            currentStreak: admin.firestore.FieldValue.increment(1),
            gamesWon: admin.firestore.FieldValue.increment(1),
            gamesPlayed: admin.firestore.FieldValue.increment(1)
        } };
    } else {
        statUpdate = { stats: {
            currentStreak: 0,
            gamesWon: admin.firestore.FieldValue.increment(0),
            gamesPlayed: admin.firestore.FieldValue.increment(1)
        } };
    }
    return userSnapshot.update(statUpdate)
}
