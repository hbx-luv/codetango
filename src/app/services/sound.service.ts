import {Injectable} from '@angular/core';

const BASE_PATH = '../../assets/sounds';

export enum Sound {
  NEW_CLUE = 'new-clue-alert.wav',
  PROPOSED_CLUE = 'ask-first-alert.wav',
  WIN = 'win.mp3',
  LOSE = 'lose.mp3',
}

@Injectable({providedIn: 'root'})
export class SoundService {
  private isMuted = false;
  private loadedSounds: {[sound: string]: HTMLAudioElement} = {};

  constructor() {
    // load up each of the sounds into the cache
    Object.values(Sound).forEach(this.getSound.bind(this));
  }

  play(sound: Sound) {
    if (!this.isMuted) {
      const file = this.getSound(sound);
      file.play();
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
    if (element) return element;

    // otherwise load the file, cache it, and return it
    element = new Audio(`${BASE_PATH}/${sound}`);
    element.load();
    this.loadedSounds[sound] = element;
    return element;
  }
}
