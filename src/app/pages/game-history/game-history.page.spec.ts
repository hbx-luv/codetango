import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { GameHistoryPage } from './game-history.page';

describe('GameHistoryPage', () => {
  let component: GameHistoryPage;
  let fixture: ComponentFixture<GameHistoryPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GameHistoryPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(GameHistoryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
