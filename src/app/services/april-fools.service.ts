import {Injectable} from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';
import {BehaviorSubject} from 'rxjs';

/** Only this account may change the global April Fools flag in the UI. */
export const APRIL_FOOLS_ADMIN_EMAIL = 'taylor.matt777@gmail.com';

const SETTINGS_DOC_PATH = 'settings/aprilFools';

interface AprilFoolsSettings {
  enabled?: boolean;
}

@Injectable({providedIn: 'root'})
export class AprilFoolsService {
  private readonly enabledSubject = new BehaviorSubject<boolean>(false);

  /** Mirrors `settings/aprilFools.enabled` for all clients. */
  readonly enabled$ = this.enabledSubject.asObservable();

  constructor(private readonly afs: AngularFirestore) {
    this.afs.doc<AprilFoolsSettings>(SETTINGS_DOC_PATH)
        .valueChanges()
        .subscribe(doc => {
          this.enabledSubject.next(!!doc?.enabled);
        });
  }

  get enabled(): boolean {
    return this.enabledSubject.value;
  }

  isAdminUser(email: string|null|undefined): boolean {
    return (email || '').toLowerCase() === APRIL_FOOLS_ADMIN_EMAIL;
  }

  setEnabled(value: boolean): void {
    this.afs.doc(SETTINGS_DOC_PATH).set({enabled: value}, {merge: true});
  }
}
