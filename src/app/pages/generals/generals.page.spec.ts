import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { GeneralsPage } from './generals.page';

describe('GeneralsPage', () => {
  let component: GeneralsPage;
  let fixture: ComponentFixture<GeneralsPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GeneralsPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(GeneralsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
