import { Component, OnInit } from '@angular/core';
import {AngularFirestore} from '@angular/fire/firestore';

@Component({
  selector: 'app-clues',
  templateUrl: './clues.component.html',
  styleUrls: ['./clues.component.scss'],
})
export class CluesComponent implements OnInit {

  constructor(private afs: AngularFirestore) { }

  clue: string;
  clueCount: number;

  ngOnInit() {}

  async submitClue() {
    const clueDto = {
      clue: this.clue,
      clueCount: this.clueCount,
      team: 'Blue' // fix this
    };

    await this.afs.collection('games')
        .doc('firstGame')
        .collection('clues')
        .add(clueDto);

    this.clue = null;
    this.clueCount = null;
  }
}
