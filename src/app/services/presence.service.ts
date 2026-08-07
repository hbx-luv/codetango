import {Injectable, NgZone} from '@angular/core';
import {Auth, authState} from '@angular/fire/auth';
import {doc, Firestore, setDoc} from '@angular/fire/firestore';
import {combineLatest, Observable, of, timer} from 'rxjs';
import {map} from 'rxjs/operators';

import {User} from '../../../types';

import {UserService} from './user.service';

// how often (at most) we write the heartbeat to Firestore
const WRITE_THROTTLE_MS = 30 * 1000;

// a visible tab keeps you "active" this long after your last interaction
const IDLE_CUTOFF_MS = 5 * 60 * 1000;

// how often active-user lists re-evaluate without any Firestore change
const RECHECK_MS = 10 * 1000;

// a user is considered active when their heartbeat is this fresh
export const ACTIVE_WINDOW_MS = 60 * 1000;

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'];

/**
 * Tracks whether the current user is interacting with the page and writes a
 * throttled `lastActive` heartbeat to their user doc. Interaction is any
 * pointer/key/touch event while the tab is visible; a visible tab also keeps
 * the heartbeat going for a few minutes after the last interaction (reading
 * the board still counts as present). A hidden tab writes nothing.
 */
@Injectable({providedIn: 'root'})
export class PresenceService {
  private uid: string|null = null;
  private lastLocalActivity = Date.now();
  private lastWrite = 0;

  constructor(
      auth: Auth,
      zone: NgZone,
      private readonly firestore: Firestore,
      private readonly userService: UserService,
  ) {
    authState(auth).subscribe(user => {
      this.uid = user?.uid ?? null;
      this.lastWrite = 0;  // heartbeat right away on login
      this.maybeWrite();
    });

    // activity listeners fire constantly (pointermove!) — keep them out of
    // Angular's zone so they don't trigger change detection
    zone.runOutsideAngular(() => {
      const onActivity = () => {
        this.lastLocalActivity = Date.now();
        this.maybeWrite();
      };
      for (const event of ACTIVITY_EVENTS) {
        document.addEventListener(event, onActivity, {passive: true});
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          onActivity();
        }
      });
      setInterval(() => this.heartbeat(), WRITE_THROTTLE_MS);
    });
  }

  /** True when the user's heartbeat is fresh (you always count as active) */
  isActive(user: User|undefined): boolean {
    if (!user) {
      return false;
    }
    // Bots have no heartbeat but should always count as present so they show in
    // the lobby and get included when teams are assigned.
    if (user.isBot) {
      return true;
    }
    if (user.id === this.uid) {
      return true;
    }
    return !!user.lastActive &&
        Date.now() - user.lastActive < ACTIVE_WINDOW_MS;
  }

  /**
   * The subset of the given users that are currently active, re-evaluated
   * whenever a user doc changes and every few seconds as heartbeats age out
   */
  activeUserIds(userIds: string[]): Observable<string[]> {
    if (!userIds?.length) {
      return of([]);
    }
    return combineLatest([
      combineLatest(userIds.map(id => this.userService.getUser(id))),
      timer(0, RECHECK_MS),
    ]).pipe(map(([users]) => users.filter(user => this.isActive(user))
                                 .map(user => user.id)));
  }

  private heartbeat() {
    if (Date.now() - this.lastLocalActivity < IDLE_CUTOFF_MS) {
      this.maybeWrite();
    }
  }

  private maybeWrite() {
    if (!this.uid || document.visibilityState !== 'visible' ||
        Date.now() - this.lastWrite < WRITE_THROTTLE_MS) {
      return;
    }
    this.lastWrite = Date.now();
    setDoc(
        doc(this.firestore, 'users', this.uid), {lastActive: Date.now()},
        {merge: true})
        .catch((_e: unknown) => {
          // offline or rules hiccup — the next heartbeat will retry
        });
  }
}
