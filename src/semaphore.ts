/**
 * Async-Synchro - Library for asynchronous locking and concurrency
 * 
 * Copyright 2022 Chris Pikul, MIT licensed.
 * 
 * See project root for ./LICENSE file.
 * 
 * NPM: https://npmjs.com/package/async-synchro
 * GITHUB: https://github.com/chris-pikul/async-synchro
 */

import { ErrCancelled, SynchroError } from './errors';

import type {
  LockCB,
  LockRejector,
  LockResolver,
  LockTicket,
  QueuedPromise,
} from './types';

/**
 * Options available for Semaphore objects
 */
export interface SemaphoreOptions {

  /**
   * Callback executed whenever an aquisition is made.
   */
  onAquire ?: () => void;
  
  /**
   * Callback executed whenever a lock is released.
   */
  onRelease ?: () => void;

  /**
   * Callback executed AFTER a Semaphore has it's locks cancelled.
   */
  onCancel ?: () => void;

  /**
   * Error object that is thrown when the locks are cancelled.
   */
  errorCancelled ?: (Error|SynchroError);
};

/**
 * Semaphore for allowing a number of concurrent locks.
 */
export default class Semaphore {
  /**
   * Readonly set of default options that will be used when constructing a new
   * Semaphore object.
   */
  public static readonly DefaultOptions:SemaphoreOptions = { errorCancelled: ErrCancelled };

  /**
   * Maximum number of concurrent 
   */
  readonly #maxConcurrent:number = 1;

  /**
   * Options dictating how this semaphore will work
   */
  #options:SemaphoreOptions;

  /**
   * Numerical value determining how many further locks are allowed.
   * 
   * Instantiated at the value of maxConcurrents and decremented for each lock
   * aquired. As long as this value is positive, further lock aquisitions will
   * be passed through unabated. When this value reaches 0, further locks must
   * wait until an existing lock is released. 
   */
  #allowed:number;

  /**
   * List of locks aquired on this Semaphore.
   */
  #queue:Array<QueuedPromise> = [];

  /**
   * @param maxConcurrent Positive integer of the maximum number of concurrent
   * users of this Semaphore. **Default = 1**.
   * @param options Additional settings declaring how this semaphore operates.
   * **Default = Semaphore.DefaultOptions**.
   * @param options.onAquire Function which is called when ever an aquisition
   * is made.
   * @param options.onRelease Function which is called when ever a lock
   * releases.
   * @param options.onCancel Function which is called after the semaphore has
   * all it's locks cancelled and the Semaphore is reset.
   * @param options.errorCancelled The error value thrown to each lock when the
   * Semaphore has been cancelled.
   */
  constructor(maxConcurrent?:number, options?:SemaphoreOptions) {
    // Bind methods
    this.acquire = this.acquire.bind(this);
    this.guard = this.guard.bind(this);

    // Ensure the maxConcurrent is a number at least 1 if provided
    if(maxConcurrent) {
      if(typeof maxConcurrent !== 'number')
        throw new TypeError(`Semaphore was constructed with a maxConcurrent of type "${typeof maxConcurrent}", a positive number is required`);
      else if(maxConcurrent <= 0)
        throw new TypeError(`Semaphore was constructed with a maxConcurrent value below 1 "${maxConcurrent}", only positive values are supported`);
      this.#maxConcurrent = Math.trunc(maxConcurrent);
    } else {
      this.#maxConcurrent = 1;
    }

    // Assign the options by overloading the defaults with a spread
    this.#options = {
      ...Semaphore.DefaultOptions,
      ...(options ?? {}),
    };

    // Initiate the allowed value for tracking lock numbers
    this.#allowed = this.#maxConcurrent;
  }

  /**
   * The set number of allowed concurrent users of this Semaphore
   */
  get maxConcurrent():number {
    return this.#maxConcurrent;
  }

  /**
   * Is this semaphore currently locked?
   * 
   * This is true when the `maxConcurrent` users has been achieved and any
   * further aquires must wait until an existing lock is released.
   */
  get isLocked():boolean {
    return (this.#allowed <= 0);
  }

  /**
   * Attempts to acquire usage of this Semaphore or wait until a slot becomes
   * available. The promise resolves to a tuple containing the releaser
   * function and a number representing the amount of slots still available
   * on this semaphore.
   * 
   * After aquiring a lock on this Semaphore, you **must call the releaser**
   * or else the whole thread will lock-up. To prevent potential disasters the
   * method {@link Semaphore.guard} is provided to do this for you
   * automatically.
   * 
   * In the event that the aquired locks are cancelled by
   * {@link Semaphore.cancelAll}, then the promises will be rejected with the
   * error set in the options when the `Semaphore` was constructed (defaults to
   * `ErrCancelled`).
   * 
   * ---------------------------------------------------------------------------
   * 
   * ```
   * // With Async/Await
   * try {
   *    const [ release, available ] = await sem.acquire();
   * 
   *    // Lock is acquired and work can be performed
   *    ...
   * 
   *    release();
   * } catch(err) {
   *    // The locks where cancelled
   *    console.error(err.message);
   * }
   * 
   * // With Promises
   * sem.acquire()
   *  .then(([ release, available ]) => {
   *    // Lock is acquired and work can be performed
   *    ...
   *    release();
   *  })
   *  .catch(err => console.error(err.message));
   * ```
   * 
   * ---------------------------------------------------------------------------
   * 
   * @see {@link Semaphore.guard} for a safer alternative
   * @returns Promise resolving to a tuple composed of the releaser function,
   * and the number of available slots on this Semaphore
   */
  acquire():Promise<LockTicket> {
    // Cache the lock status since the promise resolution might change it
    const wasLocked = this.isLocked;

    // Construct the returning promise
    const prom = new Promise<LockTicket>(this.#enque);

    // If there was no lock, start dispatching the queue
    if(!wasLocked)
      this.#dispatch();

    // If we wanted to listen, fire of an event
    if(this.#options.onAquire)
      this.#options.onAquire();

    return prom;
  }

  /**
   * Performs a lock acquisition on this semaphore that is automatically guarded
   * to ensure proper release after the provided callback is executed.
   * 
   * The callback is provided a number parameter representing the slots
   * available on this Semaphore. Any results returned by the callback are then
   * piped through the promise resolver.
   * 
   * ---------------------------------------------------------------------------
   * ```
   * // Usage with Async/Await
   * try {
   *    const results = await sem.guard(available => {
   *      // Perform work here
   *      ...
   * 
   *      return 42;
   *    });
   * 
   *    console.log(results); // 42
   * } catch(err) {
   *    // The locks where cancelled
   *    console.error(err.message);
   * }
   * 
   * 
   * // Usage with Promises
   * sem.guard(available => {
   *    // Lock aquired, perform work here
   *    ...
   * 
   *    return 42;
   * }).then(results => {
   *    // The results are piped through
   *    console.log(results); // 42
   * }).catch(err => {
   *    // The locks where all cancelled
   *    console.error(err.message);
   * });
   * ```
   * ---------------------------------------------------------------------------
   * 
   * @param cb Callback function executed when acquisition is available, the
   * callback receives a number as its parameter equal to the number of
   * available slots.
   * @returns Promise resolving to the results of the callback function
   */
  async guard<T>(cb:LockCB<T>):Promise<T> {
    const [ release, avail ] = await this.acquire();

    let value:T;
    try {
      value = await cb(avail);
    } finally {
      release();
    }
    return value;
  }

  /**
   * Cancels all queued locks by rejecting their promises.
   * 
   * The error returned is the one set in the options when the Semaphore was
   * constructed. This defaults to {@link ErrCancelled}.
   * 
   * After cancelling, the queue, and available slots are reset.
   */
  cancelAll():void {
    // Reject each of the waiting promises in the queue and empty it
    this.#queue.forEach(({ reject }) => reject(this.#options.errorCancelled ?? ErrCancelled));
    this.#queue = [];

    // Reset the allowed value for better concurrent
    this.#allowed = this.#maxConcurrent;
  }

  #enque(resolve:LockResolver, reject:LockRejector):void {
    this.#queue.push({
      resolve,
      reject,
    });
  }

  #dispatch():void {
    // Grab the first enqueued entry in the line, or short-circuit if none
    const next:(QueuedPromise|undefined) = this.#queue.shift();
    if(!next)
      return;

    // Save the released state for the releaser
    let released = false;

    // Make the releaser function for resolving
    const releaser = () => {
      // Shortcut out if already released
      if(released)
        return;
      released = true;

      // Increment available slots
      this.#allowed++;

      // If we wanted to listen, fire of the event
      if(this.#options.onRelease)
        this.#options.onRelease();

      // Recursivly dispatch the next lock
      this.#dispatch();
    };

    // Construct the ticket tuple
    const ticket:LockTicket = [ releaser, this.#maxConcurrent - this.#allowed ];

    // Resolve the waiting promise
    next.resolve(ticket);
  }
}
