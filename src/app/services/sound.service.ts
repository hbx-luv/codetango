import {Injectable} from '@angular/core';

const BASE_PATH = '../../assets/sounds';

export const enum Sound {
  NEW_CLUE = 'new-clue-alert.wav',
  PROPOSED_CLUE = 'ask-first-alert.wav',
  NEW_MESSAGE = 'new-message.mp3',
  WIN = 'win.mp3',
  LOSE = 'lose.mp3',
  CORRECT_GUESS = 'correct-guess.wav',
  WRONG_GUESS = 'wrong-guess.wav',
  ASSASSIN = 'assassin.wav',
}

@Injectable({providedIn: 'root'})
export class SoundService {
  private isMuted = false;
  private loadedSounds: {[sound: string]: HTMLAudioElement} = {};

  constructor() {}

  play(sound: Sound) {
    if (!this.isMuted) {
      const file = this.getSound(sound);
      // browsers reject play() before the user has interacted with the page
      file.play().catch(_e => {});
    }
  }

  muted() {
    return this.isMuted;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
  }

  private getSound(sound: Sound): HTMLAudioElement {
    // look for the loaded sound in cache
    let element = this.loadedSounds[sound];
    if (element) {
      return element;
    }

    // otherwise load the file, cache it, and return it
    element = new Audio(`${BASE_PATH}/${sound}`);
    element.load();
    this.loadedSounds[sound] = element;
    return element;
  }
}
