import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {IonicModule} from '@ionic/angular';

import {GiveClueComponent} from './give-clue.component';

describe('GiveClueComponent', () => {
  let component: GiveClueComponent;
  let fixture: ComponentFixture<GiveClueComponent>;

  beforeEach(async(() => {
    TestBed
        .configureTestingModule({
          declarations: [GiveClueComponent],
          imports: [IonicModule.forRoot()]
        })
        .compileComponents();

    fixture = TestBed.createComponent(GiveClueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
