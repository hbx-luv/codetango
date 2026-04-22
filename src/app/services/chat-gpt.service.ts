import {Injectable} from '@angular/core';
import {Functions, httpsCallable} from '@angular/fire/functions';
import {CodenamesClueResponse} from 'types';

@Injectable({providedIn: 'root'})
export class ChatGptService {
  constructor(
      private readonly functions: Functions,
  ) {}

  async getClue(gameId: string, team: string): Promise<CodenamesClueResponse> {
    const askChatGpt = httpsCallable<string, CodenamesClueResponse>(
        this.functions, 'askChatGpt');
    const result = await askChatGpt([gameId, team].join('_'));
    return result.data;
  }
}
