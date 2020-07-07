import { TestBed } from '@angular/core/testing';

import { EloHistoryService } from './elo-history.service';

describe('EloHistoryService', () => {
  let service: EloHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EloHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
