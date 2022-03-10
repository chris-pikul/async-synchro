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
import { LockRejector, LockResolver, QueuedPromise, Releaser } from './types';

export type MutexLockCB<T> = () => (Promise<T> | T);

export interface MutexOptions {

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

export default class Mutex {
  /**
   * Readonly set of default options that will be used when constructing a new
   * Semaphore object.
   */
  public static readonly DefaultOptions:MutexOptions = { errorCancelled: ErrCancelled };

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

  constructor(options?:MutexOptions) {
    // Bind methods
    this.lock = this.lock.bind(this);

    // Assign the options by overloading the defaults with a spread
    this.options = {
      ...Mutex.DefaultOptions,
      ...(options ?? {}),
    };

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

  lock():Promise<Releaser> {
    if(this.#locked) {
      // Construct the returning promise
      // eslint-disable-next-line no-promise-executor-return
      return new Promise<Releaser>((res, rej) => this.#enque(res, rej));
    }

    this.#locked = true;

    // If we wanted to listen, fire off an event
    if(typeof this.options.onAquire === 'function')
      this.options.onAquire();

    return Promise.resolve(this.#makeReleaser());
  }

  #enque(resolve:LockResolver, reject:LockRejector):void {
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

    // Resolve the promise to pass through the releaser
    next.resolve(this.#makeReleaser());
  }

  #makeReleaser():Releaser {
    let released = false;

    return ():void => {
      // Short-circuit out if already released
      if(released)
        return;
      released = true;

      // If there is queued promises, let them process. Otherwise unlock
      if(this.#queue.length > 0)
        this.#deque();
      else
        this.#locked = false;
      
      // Fire off the event if we are listening
      if(typeof this.options.onRelease === 'function')
        this.options.onRelease();
    };
  }
}
