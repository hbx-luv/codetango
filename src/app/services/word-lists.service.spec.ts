import { TestBed } from '@angular/core/testing';

import { WordListsService } from './word-lists.service';

describe('WordListsService', () => {
  let service: WordListsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WordListsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
