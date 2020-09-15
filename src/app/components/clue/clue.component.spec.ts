import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ClueComponent } from './clue.component';

describe('ClueComponent', () => {
  let component: ClueComponent;
  let fixture: ComponentFixture<ClueComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ClueComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(ClueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
