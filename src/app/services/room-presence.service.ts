import {Injectable, NgZone, OnDestroy} from '@angular/core';
import {Auth} from '@angular/fire/auth';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  setDoc,
} from '@angular/fire/firestore';
import {combineLatest, Observable, of, timer} from 'rxjs';
import {map} from 'rxjs/operators';

// how often each open tab re-stamps its session while visible
const HEARTBEAT_MS = 30 * 1000;

// a session is a live watcher while its heartbeat is this fresh; covers one
// missed heartbeat before the viewer drops off the list
const FRESH_WINDOW_MS = 75 * 1000;

// sessions this stale get garbage-collected by whoever notices them
const GC_AFTER_MS = 10 * 60 * 1000;

// how often watcher lists re-evaluate without a Firestore change
const RECHECK_MS = 10 * 1000;

interface PresenceSession {
  userId: string|null;
  lastSeen: number;
  id?: string;
}

export interface RoomWatchers {
  // distinct signed-in viewers of the page (players and lurkers alike --
  // consumers subtract team members to get spectators)
  userIds: string[];
  // count of anonymous (signed-out) sessions
  anonymous: number;
}

/**
 * Tracks "who has this room open" via per-tab heartbeat docs at
 * rooms/{roomId}/presence/{sessionId}. Works for signed-out viewers too:
 * their session carries userId null and is shown as an anonymous watcher.
 * Sessions vanish when the tab closes (best-effort delete on pagehide) or
 * once the heartbeat goes stale.
 */
@Injectable({providedIn: 'root'})
export class RoomPresenceService implements OnDestroy {
  private roomId: string|null = null;
  private heartbeatTimer?: number;
  private readonly sessionId: string;
  private readonly onPageHide = () => this.stop();
  private readonly onVisible = () => {
    if (document.visibilityState === 'visible') {
      this.beat();
    }
  };

  constructor(
      private readonly firestore: Firestore,
      private readonly auth: Auth,
      private readonly zone: NgZone,
  ) {
    // per-tab id: survives reloads of the same tab, differs across tabs
    const existing = sessionStorage.getItem('ct-presence-session');
    this.sessionId = existing ?? crypto.randomUUID();
    if (!existing) {
      sessionStorage.setItem('ct-presence-session', this.sessionId);
    }
  }

  /** Start heartbeating for the given room (idempotent per room). */
  track(roomId: string) {
    if (this.roomId === roomId) {
      return;
    }
    this.stop();
    this.roomId = roomId;
    this.beat();
    this.zone.runOutsideAngular(() => {
      this.heartbeatTimer =
          window.setInterval(() => this.onVisible(), HEARTBEAT_MS);
      document.addEventListener('visibilitychange', this.onVisible);
      window.addEventListener('pagehide', this.onPageHide);
    });
  }

  /** Stop heartbeating and remove this tab's session doc (best effort). */
  stop() {
    if (!this.roomId) {
      return;
    }
    const ref = this.sessionRef(this.roomId);
    this.roomId = null;
    window.clearInterval(this.heartbeatTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('pagehide', this.onPageHide);
    deleteDoc(ref).catch((_e: unknown) => {
      // offline or already gone -- staleness will clean it up
    });
  }

  /**
   * Live watchers of a room: distinct signed-in user ids plus a count of
   * anonymous sessions, re-evaluated as heartbeats age out
   */
  watchers(roomId: string): Observable<RoomWatchers> {
    if (!roomId) {
      return of({userIds: [], anonymous: 0});
    }
    const sessions$ = collectionData(
                          collection(this.firestore, 'rooms', roomId, 'presence'),
                          {idField: 'id'}) as Observable<PresenceSession[]>;
    return combineLatest([sessions$, timer(0, RECHECK_MS)])
        .pipe(map(([sessions]) => {
          const now = Date.now();
          const userIds = new Set<string>();
          let anonymous = 0;
          for (const session of sessions) {
            const age = now - (session.lastSeen ?? 0);
            if (age > GC_AFTER_MS && session.id) {
              // fire-and-forget cleanup of long-dead sessions
              deleteDoc(doc(this.firestore, 'rooms', roomId, 'presence',
                            session.id))
                  .catch((_e: unknown) => {});
              continue;
            }
            if (age > FRESH_WINDOW_MS) {
              continue;
            }
            if (session.userId) {
              userIds.add(session.userId);
            } else {
              anonymous++;
            }
          }
          return {userIds: [...userIds], anonymous};
        }));
  }

  private beat() {
    if (!this.roomId) {
      return;
    }
    setDoc(this.sessionRef(this.roomId), {
      userId: this.auth.currentUser?.uid ?? null,
      lastSeen: Date.now(),
    }).catch((_e: unknown) => {
      // offline or rules hiccup -- the next heartbeat will retry
    });
  }

  private sessionRef(roomId: string) {
    return doc(this.firestore, 'rooms', roomId, 'presence', this.sessionId);
  }

  ngOnDestroy() {
    this.stop();
  }
}
