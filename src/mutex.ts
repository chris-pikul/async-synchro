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

import SynchroError, { ErrCancelled } from './errors';
import {
  LockRejector,
  LockResolver,
  QueuedPromise,
  Releaser,
} from './types';

export type MutexLockCB<T> = () => (Promise<T> | T);

export interface MutexOptions {

  /**
   * Callback executed whenever a lock is achieved.
   */
  onLock ?: () => void;
  
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
 * Single-user concurrency lock. Only allows one lock at a time.
 */
export default class Mutex {
  /**
   * Options dictating how this mutex will work
   */
  options:MutexOptions;

  /**
   * Determines if there is an active lock on this Mutex
   */
  #locked;

  /**
   * Queue of locks waiting on this Mutex
   */
  #queue:Array<QueuedPromise>;

  /**
   * @param options Additional settings for Mutex operation.
   * @param options.onLock Function which is called when a lock is acquired.
   * @param options.onRelease Function which is called whenever a lock is
   * released/unlocked
   * @param options.onCancel Function called when all the locks have been
   * cancelled by `cancelAll`.
   * @param options.errorCancelled Error object that is thrown when the promises
   * are rejected via `cancelAll`.
   */
  constructor(options?:MutexOptions) {
    // Bind methods
    this.lock = this.lock.bind(this);
    this.guard = this.guard.bind(this);
    this.cancelAll = this.cancelAll.bind(this);

    // Assign the options by overloading the defaults with a spread
    this.options = { ...(options ?? {}) };

    // Ensure we are unlocked at the beginning
    this.#locked = false;
    this.#queue = [];
  }

  /**
   * Is this Mutex currently locked?
   */
  get isLocked():boolean {
    return this.#locked;
  }

  /**
   * Attempts to lock this Mutex, or wait until the previous locks are released.
   * The promise returned resolves giving a function to call to release/unlock
   * the mutex.
   * 
   * After locking this Mutex, you **must call the releaser** function or else
   * the waiting locks will never be resolved, potentially locking your
   * execution thread later. It is suggested that you use the guarded lock
   * method {@link Mutex.guard} instead, as this will automatically lock and 
   * release for you.
   * 
   * In the event that a waiting lock is cancelled via {@link Mutex.cancelAll},
   * then the promises will be rejected with the error set either in the
   * arguments of the `cancelAll` method, the one set in the Mutex constructor
   * options, or {@link ErrCancelled} if none of the others are set.
   * 
   * ---------------------------------------------------------------------------
   * 
   * ```
   * // With Async/Await
   * try {
   *    const unlock = await mtx.lock();
   * 
   *    // Lock is acquired and work can be performed
   *    ...
   * 
   *    unlock();
   * } catch(err) {
   *    // The lock was cancelled
   * }
   * 
   * // With Promises
   * mtx.lock()
   *  .then(unlock => {
   *    // Lock is acquired and work can be performed
   *    ...
   *    unlock();
   *  }).catch(err => {
   *    // The lock was cancelled
   *  });
   * ```
   * 
   * ---------------------------------------------------------------------------
   * 
   * @returns Promise resolving with the unlock releaser
   */
  lock():Promise<Releaser> {
    const wasLocked = this.isLocked;

    // eslint-disable-next-line no-promise-executor-return
    const prom = new Promise<Releaser>((res, rej) => this.#enque(res, rej));

    if(!wasLocked) {
      // If we wanted to listen, fire off an event
      if(typeof this.options.onLock === 'function')
        this.options.onLock();

      this.#deque();
    }

    return prom;
  }

  /**
   * Performs lock acquisition and unlock/releasing for you.
   * 
   * When the lock is achieved (possibly after others have unlocked), the
   * callback function will be executed. Any value returned by the callback will
   * be passed through when the promise resolves.
   * 
   * Any errors thrown during the callbacks execution will **not** be caught by 
   * this wrapper, and will bubble up accordingly. This includes the one thrown
   * by calling {@link Mutex.cancelAll}.
   * 
   * ---------------------------------------------------------------------------
   * 
   * ```
   * // With Async/Await
   * try {
   *    const results = await mtx.guard(() => {
   *      // Lock is acquired, perform work
   *      ...
   * 
   *      // Return if you wish for convienience
   *      return 42;
   *    });
   * 
   *    console.log(results); // 42
   * } catch(err) {
   *    // Lock was cancelled
   * }
   * 
   * // With Promises
   * mtx.guard(() => {
   *    // Lock is acquired, perform work
   *    ...
   * 
   *    // Return if you wish for convienience
   *    return 42;
   * }).then(results => {
   *    console.log(results); // 42
   * }).catch(err => {
   *    // Lock was cancelled
   * });
   * ```
   * 
   * ---------------------------------------------------------------------------
   * 
   * @param cb Callback function executed when the lock is acquired
   * @returns Promise resolving to the results returned by the callback
   */
  async guard<T = any>(cb:MutexLockCB<T>):Promise<T> {
    // Perform the standard locking
    const release = await this.lock();

    // Setup a variable for the return results
    let value:T;
    try {
      // Use the callback as an async function
      value = await cb();
    } finally {
      // Always release the lock, regardless of errors
      release();
    }

    // Return the results from the callback
    return value;
  }

  /**
   * Cancels all waiting locks on this Mutex by rejecting their promises.
   * 
   * The error given in the rejection is one of the following (whichever applies
   * first):
   * 
   * - The `err` parameter.
   * - The `errorCancelled` option set in the Mutex constructor options.
   * - The {@link ErrCancelled} default error.
   * 
   * @param err Optional custom error to throw
   */
  cancelAll(err?:Error):void {
    // Reject all of the waiting promises and empty the queue
    this.#queue.forEach(({ reject }) => reject(err ?? this.options.errorCancelled ?? ErrCancelled));
    this.#queue = [];

    // Unlock the mutex
    this.#locked = false;

    // Fire the event is asked for
    if(typeof this.options.onCancel === 'function')
      this.options.onCancel();
  }

  #enque(resolve:LockResolver, reject:LockRejector):void {
    // By adding to the queue we are locking by nature
    this.#locked = true;

    // Add to the end of the queue the promise functions
    this.#queue.push({
      resolve,
      reject,
    } as QueuedPromise);
  }

  #deque():void {
    // Grab the next queued promise if one is available
    const next:(QueuedPromise|undefined) = this.#queue.shift();
    if(!next)
      return;

    // If we wanted to listen, fire off an event
    if(typeof this.options.onLock === 'function')
      this.options.onLock();

    // Resolve the promise to pass through the releaser
    next.resolve(this.#makeReleaser());
  }

  #makeReleaser():Releaser {
    // Cache the released state
    let released = false;

    return ():void => {
      // Short-circuit out if already released
      if(released)
        return;
      released = true;

      // Fire off the event if we are listening
      if(typeof this.options.onRelease === 'function')
        this.options.onRelease();

      // If there is queued promises, let them process. Otherwise unlock
      if(this.#queue.length > 0)
        this.#deque();
      else
        this.#locked = false;
    };
  }
}
