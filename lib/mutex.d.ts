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
import SynchroError from './errors';
import { Releaser } from './types';
export declare type MutexLockCB<T> = () => (Promise<T> | T);
export interface MutexOptions {
    /**
     * Callback executed whenever a lock is achieved.
     */
    onLock?: () => void;
    /**
     * Callback executed whenever a lock is released.
     */
    onRelease?: () => void;
    /**
     * Callback executed AFTER a Semaphore has it's locks cancelled.
     */
    onCancel?: () => void;
    /**
     * Error object that is thrown when the locks are cancelled.
     */
    errorCancelled?: (Error | SynchroError);
}
/**
 * Single-user concurrency lock. Only allows one lock at a time.
 */
export default class Mutex {
    #private;
    /**
     * Options dictating how this mutex will work
     */
    options: MutexOptions;
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
    constructor(options?: MutexOptions);
    /**
     * Is this Mutex currently locked?
     */
    get isLocked(): boolean;
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
    lock(): Promise<Releaser>;
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
    guard<T = any>(cb: MutexLockCB<T>): Promise<T>;
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
    cancelAll(err?: Error): void;
}
