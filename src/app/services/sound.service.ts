import {Injectable} from '@angular/core';

const BASE_PATH = '../../assets/sounds';
const SETTINGS_KEY = 'codetango-sound-settings';

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

export const enum SoundCategory {
  TILES = 'tiles',
  CLUES = 'clues',
  CHAT = 'chat',
  GAME_END = 'gameEnd',
}

// which category each sound belongs to, for the per-category toggles
const SOUND_CATEGORIES: {[sound: string]: SoundCategory} = {
  [Sound.CORRECT_GUESS]: SoundCategory.TILES,
  [Sound.WRONG_GUESS]: SoundCategory.TILES,
  [Sound.ASSASSIN]: SoundCategory.TILES,
  [Sound.NEW_CLUE]: SoundCategory.CLUES,
  [Sound.PROPOSED_CLUE]: SoundCategory.CLUES,
  [Sound.NEW_MESSAGE]: SoundCategory.CHAT,
  [Sound.WIN]: SoundCategory.GAME_END,
  [Sound.LOSE]: SoundCategory.GAME_END,
};

export interface SoundCategoryOption {
  category: SoundCategory;
  label: string;
  icon: string;
}

export const SOUND_CATEGORY_OPTIONS: SoundCategoryOption[] = [
  {category: SoundCategory.TILES, label: 'Tile Flips', icon: 'grid-outline'},
  {category: SoundCategory.CLUES, label: 'Clues', icon: 'bulb-outline'},
  {
    category: SoundCategory.CHAT,
    label: 'Chat Messages',
    icon: 'chatbox-outline'
  },
  {
    category: SoundCategory.GAME_END,
    label: 'Game Endings',
    icon: 'trophy-outline'
  },
];

interface SoundSettings {
  enabled: boolean;
  categories: {[category: string]: boolean};
}

@Injectable({providedIn: 'root'})
export class SoundService {
  private settings: SoundSettings = {enabled: true, categories: {}};
  private loadedSounds: {[sound: string]: HTMLAudioElement} = {};

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (saved) {
        this.settings = {
          enabled: saved.enabled !== false,
          categories: saved.categories ?? {},
        };
      }
    } catch (_e) {
      // corrupt settings, fall back to defaults
    }
  }

  play(sound: Sound) {
    if (this.settings.enabled &&
        this.categoryEnabled(SOUND_CATEGORIES[sound])) {
      const file = this.getSound(sound);
      // browsers reject play() before the user has interacted with the page
      file.play().catch(_e => {});
    }
  }

  muted() {
    return !this.settings.enabled;
  }

  enabled() {
    return this.settings.enabled;
  }

  setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    this.save();
  }

  categoryEnabled(category: SoundCategory): boolean {
    // categories default to on until explicitly toggled off
    return this.settings.categories[category] !== false;
  }

  setCategoryEnabled(category: SoundCategory, enabled: boolean) {
    this.settings.categories[category] = enabled;
    this.save();
  }

  private save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
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
