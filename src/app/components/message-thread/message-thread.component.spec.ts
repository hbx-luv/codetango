import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MessageThreadComponent } from './message-thread.component';

describe('MessageThreadComponent', () => {
  let component: MessageThreadComponent;
  let fixture: ComponentFixture<MessageThreadComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MessageThreadComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(MessageThreadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
