import { TestBed } from '@angular/core/testing';

import { ClueService } from './clue.service';

describe('ClueService', () => {
  let service: ClueService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClueService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
