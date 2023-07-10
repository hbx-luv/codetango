import {Injectable} from '@angular/core';
import {AngularFireFunctions} from '@angular/fire/functions';
import {CodenamesClueResponse} from 'types';

@Injectable({providedIn: 'root'})
export class ChatGptService {
  constructor(
      private readonly aff: AngularFireFunctions,
  ) {}

  async getClue(gameId: string, team: string): Promise<CodenamesClueResponse> {
    const askChatGpt =
        this.aff.httpsCallable<string, CodenamesClueResponse>('askChatGpt');
    return await askChatGpt([gameId, team].join('_')).toPromise();
  }
}
