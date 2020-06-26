import {Injectable} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/auth';
import {AngularFirestore} from '@angular/fire/firestore';
import * as firebase from 'firebase';
import {User} from 'types';

import {UtilService} from './util.service';

@Injectable({providedIn: 'root'})
export class AuthService {
  authState: firebase.User|null = null;
  auth: firebase.auth.Auth;

  constructor(
      private afAuth: AngularFireAuth,
      private afs: AngularFirestore,
      private utilService: UtilService,
  ) {
    this.afAuth.onAuthStateChanged(user => {
      console.log(user);
    });

    this.auth = firebase.auth();
  }

  // Returns current user data
  get authenticated(): boolean {
    return this.auth.currentUser !== null;
  }

  // Returns current user data
  get currentUser(): firebase.User|null {
    return this.auth.currentUser;
  }

  // Returns current user ID
  get currentUserId(): string {
    return this.auth.currentUser ? this.auth.currentUser.uid : '';
  }

  /**
   * Authenticate with Google Login and return uid
   */
  async loginWithGoogle(): Promise<string> {
    const provider = new firebase.auth.GoogleAuthProvider();
    const userCredential = await this.afAuth.signInWithPopup(provider).catch(
        this.errorHandler.bind(this));

    // if we have a valid user credential, add/update the user document
    if (userCredential && userCredential.user !== null) {
      this.updateUserData(userCredential.user);
    }
    return userCredential.user.uid;
  }

  /**
   * Login given an email and password
   */
  async loginWithEmailAndPassword(email: string, password: string) {
    return this.afAuth.signInWithEmailAndPassword(email, password)
        .catch(this.errorHandler.bind(this));
  }

  /**
   * Create an account with the given email and password then save the given
   * name to their user document
   */
  async signUpWithEmailAndPassword(
      name: string, email: string, password: string) {
    const userCredential =
        await this.afAuth.createUserWithEmailAndPassword(email, password)
            .catch(this.errorHandler.bind(this));

    // if we have a valid user credential, add/update the user document
    if (userCredential && userCredential.user !== null) {
      this.updateUserData(userCredential.user, {name});
    }
  }

  /**
   * Send a password reset email and catch errors
   */
  async sendPasswordResetEmail(email: string) {
    try {
      await this.afAuth.sendPasswordResetEmail(email);
    } catch (error) {
      // do nothing in the case of a failure except re-throw
      if (!error.code.startsWith('auth/')) {
        throw error;
      }
    }
    this.utilService.showToast(
        `If an account exists for ${
            email}, an email will be sent with further instructions`,
        5000);
  }

  /**
   * Handle AngularFireAuth errors and present toasts
   */
  errorHandler(error: {code: string, message: string}) {
    let {code, message} = error;
    switch (code) {
      case 'auth/invalid-email':
        message = 'Please enter a valid email address';
        break;
      case 'auth/user-not-found':
        message = 'An account with that email address does not exist';
        break;
      case 'auth/wrong-password':
        message = 'Invalid email or password';
        break;
      case 'auth/email-already-in-use':
        message = 'This email is already in use. Login or reset password';
        break;
      case 'auth/popup-closed-by-user':
        // if they close the popup, just do nothing
        return;
      default:
        break;
    }

    // show a toast and re-throw the error if it's not from Firebase Auth
    this.utilService.showToast(message);
    if (!error.code.startsWith('auth/')) {
      throw error;
    }
  }

  /**
   * Whenever a user logs in in with any auth service, call this function to
   * add/update that user's data in Firestore
   */
  private async updateUserData(
      firebaseUser: firebase.User, additionalInfo?: Partial<User>) {
    const path = `users/${firebaseUser.uid}`;
    const data: Partial<User> = {};

    if (firebaseUser.displayName) {
      data.name = firebaseUser.displayName;
    }
    if (firebaseUser.email) {
      data.email = firebaseUser.email;
    }
    if (firebaseUser.photoURL) {
      data.photoURL = firebaseUser.photoURL;
    }

    // assign any additional info passed in
    Object.assign(data, additionalInfo);

    await this.afs.doc(path).set(data, {merge: true});
  }

  /**
   * You can never fully log out of the mobile app, logging out just spawns a
   * new anonymous account
   */
  async logout(): Promise<void> {
    this.authState = null;
    await this.afAuth.signOut();
  }
}
