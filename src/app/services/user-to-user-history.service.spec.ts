import { TestBed } from '@angular/core/testing';

import { UserToUserHistoryService } from './user-to-user-history.service';

describe('UserToUserHistoryService', () => {
  let service: UserToUserHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserToUserHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
