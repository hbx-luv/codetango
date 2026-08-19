import {Component} from '@angular/core';
import {SOUND_CATEGORY_OPTIONS, SoundCategory, SoundService} from 'src/app/services/sound.service';

@Component({
  standalone: false,
  selector: 'app-sound-settings',
  templateUrl: './sound-settings.component.html',
  styleUrls: ['./sound-settings.component.scss'],
})
export class SoundSettingsComponent {
  categoryOptions = SOUND_CATEGORY_OPTIONS;

  constructor(readonly soundService: SoundService) {}

  setEnabled(event: Event) {
    this.soundService.setEnabled((event as CustomEvent).detail.checked);
  }

  setCategoryEnabled(category: SoundCategory, event: Event) {
    this.soundService.setCategoryEnabled(
        category, (event as CustomEvent).detail.checked);
  }
}
