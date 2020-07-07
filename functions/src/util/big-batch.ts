import {firestore} from 'firebase';

// The limit of actions you can do on a single WriteBatch
export const MAX_BATCH_SIZE = 500;

export class BigBatch {
  private _size = 0;
  private batches: firestore.WriteBatch[] = [];
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Return the size of the BigBatch which is the sum of all of the batches in
   * the `batches` array
   */
  get size(): number {
    return this._size;
  }

  /**
   * Writes to the document referred to by the provided `DocumentReference`.
   * If the document does not exist yet, it will be created. If you pass
   * `SetOptions`, the provided data can be merged into the existing document.
   *
   * @param documentRef A reference to the document to be set.
   * @param data An object of the fields and values for the document.
   * @param options An object to configure the set behavior.
   * @return This `WriteBatch` instance. Used for chaining method calls.
   */
  set<T>(
      documentRef: firestore.DocumentReference<T>, data: T,
      options?: firestore.SetOptions): BigBatch {
    this.growIfNecessary();
    this._size++;
    this.batch.set(documentRef, data, options);
    return this;
  }

  /**
   * Updates fields in the document referred to by the provided
   * `DocumentReference`. The update will fail if applied to a document that
   * does not exist.
   *
   * @param documentRef A reference to the document to be updated.
   * @param data An object containing the fields and values with which to
   * update the document. Fields can contain dots to reference nested fields
   * within the document.
   * @return This `WriteBatch` instance. Used for chaining method calls.
   */
  update(documentRef: firestore.DocumentReference, data: firestore.UpdateData):
      BigBatch {
    this.growIfNecessary();
    this._size++;
    this.batch.update(documentRef, data);
    return this;
  }

  /**
   * Deletes the document referred to by the provided `DocumentReference`.
   *
   * @param documentRef A reference to the document to be deleted.
   * @return This `WriteBatch` instance. Used for chaining method calls.
   */
  delete(documentRef: firestore.DocumentReference): BigBatch {
    this.growIfNecessary();
    this._size++;
    this.batch.delete(documentRef);
    return this;
  }

  /**
   * Commits all of the batches in this big batch one after another.
   *
   * @return A Promise resolved once all of the writes in each of the batches
   * have been successfully committed to the backend as an atomic unit. Note
   * that it won't resolve while you're offline.
   */
  async commit(): Promise<void> {
    for (const batch of this.batches) {
      await batch.commit();
    }
  }

  /**
   * Return the last batch in the `batches` array, which is the one we should be
   * executing all actions on. The `growIfNecessary` function takes care of
   * adding new batches to the list as necessary so we can always safely perform
   * actions on the last batch.
   */
  private get batch(): firestore.WriteBatch {
    // be super duper safe
    if (this.batches.length === 0) {
      this.growIfNecessary();
    }
    // return the latest batch
    return this.batches[this.batches.length - 1];
  }

  /**
   * Grow the batches array when necessary, and increment the size of this
   * BigBatch
   *
   * Note: this happens when the size is 0 or whenever the size is divisible by
   * the MAX_BATCH_SIZE which is a limitation of WriteBatch
   */
  private growIfNecessary(): void {
    if (this.size % MAX_BATCH_SIZE === 0) {
      this.batches.push(this.db.batch());
    }
  }
}