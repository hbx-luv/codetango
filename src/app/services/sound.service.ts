import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundService {

  private newClueAudio;
  private askFirstAlertAudio;
  private isMuted: boolean;

  constructor() {
    this.isMuted = false;
    this.newClueAudio = new Audio('../../assets/sounds/new-clue-alert.wav');
    this.newClueAudio.load();

    this.askFirstAlertAudio = new Audio('../../assets/sounds/ask-first-alert.wav');
    this.askFirstAlertAudio.load();
  }

  newClueAlert() {
    if (!this.isMuted) {
      this.newClueAudio.play();
    }
  }
  askFirstAlert() {
    if (!this.isMuted) {
      this.askFirstAlertAudio.play();
    }
  }

  muted() {
    return this.isMuted;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
  }
}
