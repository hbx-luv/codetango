import {Injectable} from '@angular/core';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from '@angular/fire/auth';
import {doc, Firestore, setDoc} from '@angular/fire/firestore';
import {User} from 'types';

import {UtilService} from './util.service';

@Injectable({providedIn: 'root'})
export class AuthService {
  authState: FirebaseUser|null = null;

  constructor(
      private readonly auth: Auth,
      private readonly firestore: Firestore,
      private readonly utilService: UtilService,
  ) {
    authState(this.auth).subscribe(user => {
      this.authState = user;
    });
  }

  get authenticated(): boolean {
    return this.auth.currentUser !== null;
  }

  get currentUser(): FirebaseUser|null {
    return this.auth.currentUser;
  }

  get currentUserId(): string {
    return this.auth.currentUser ? this.auth.currentUser.uid : '';
  }

  async loginWithGoogle(): Promise<string> {
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(this.auth, provider);
      if (userCredential && userCredential.user !== null) {
        this.updateUserData(userCredential.user);
      }
      return userCredential.user.uid;
    } catch (error) {
      this.errorHandler(error as {code: string, message: string});
      throw error;
    }
  }

  async loginWithEmailAndPassword(email: string, password: string) {
    try {
      return await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      this.errorHandler(error as {code: string, message: string});
      throw error;
    }
  }

  async signUpWithEmailAndPassword(
      name: string, email: string, password: string) {
    try {
      const userCredential =
          await createUserWithEmailAndPassword(this.auth, email, password);
      if (userCredential && userCredential.user !== null) {
        this.updateUserData(userCredential.user, {name});
      }
    } catch (error) {
      this.errorHandler(error as {code: string, message: string});
    }
  }

  async sendPasswordResetEmail(email: string) {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error) {
      const code = (error as {code: string}).code ?? '';
      if (!code.startsWith('auth/')) {
        throw error;
      }
    }
    this.utilService.showToast(
        `If an account exists for ${
            email}, an email will be sent with further instructions`,
        5000);
  }

  errorHandler(error: {code: string, message: string}) {
    const {code} = error;
    let {message} = error;
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
        return;
      default:
        break;
    }

    this.utilService.showToast(message);
    if (!code || !code.startsWith('auth/')) {
      throw error;
    }
  }

  private async updateUserData(
      firebaseUser: FirebaseUser, additionalInfo?: Partial<User>) {
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

    Object.assign(data, additionalInfo);

    await setDoc(doc(this.firestore, path), data, {merge: true});
  }

  public async logout(): Promise<void> {
    this.authState = null;
    await signOut(this.auth);
  }
}
