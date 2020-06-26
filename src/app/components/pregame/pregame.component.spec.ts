import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { PregameComponent } from './pregame.component';

describe('TeamsComponent', () => {
  let component: PregameComponent;
  let fixture: ComponentFixture<PregameComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PregameComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(PregameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
