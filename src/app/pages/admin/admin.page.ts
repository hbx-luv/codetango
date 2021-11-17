import { Component } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { UserService } from 'src/app/services/user.service';
import { WordListsService } from 'src/app/services/word-lists.service';
import { UserRole } from 'types';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage {

  migrateOldUserId: string;
  migrateNewUserId: string;

  constructor(
    private readonly afs: AngularFirestore,
    private readonly userService: UserService,
    public readonly wordListsService: WordListsService,
  ) { }

  get showAdmin() {
    return this.userService.currentUser?.role === UserRole.ADMIN;
  }

  get migrateDisabled() {
    return !this.migrateOldUserId || !this.migrateNewUserId;
  }

  migrate() {
    this.afs.collection('admin').doc('migrate').set({
      oldUser: this.migrateOldUserId,
      newUser: this.migrateNewUserId,
    });
    delete this.migrateOldUserId;
    delete this.migrateNewUserId;
  }

}
