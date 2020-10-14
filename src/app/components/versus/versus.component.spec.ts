import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { VersusComponent } from './versus.component';

describe('VersusComponent', () => {
  let component: VersusComponent;
  let fixture: ComponentFixture<VersusComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ VersusComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(VersusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
