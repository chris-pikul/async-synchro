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
import type { Releaser, QueuedPromise } from './types';
export declare type SemaphoreTicket = [Releaser, number];
export declare type SemaphoreResolver = (ticket: SemaphoreTicket) => void;
export declare type SemaphoreLockCB<T> = (locks?: number) => (Promise<T> | T);
export declare type SemaphoreQueuedPromise = QueuedPromise<SemaphoreResolver>;
/**
 * Options available for Semaphore objects
 */
export interface SemaphoreOptions {
    /**
     * Callback executed whenever an aquisition is made.
     */
    onAquire?: () => void;
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
 * Semaphore for allowing a number of concurrent locks.
 */
export default class Semaphore {
    #private;
    /**
     * Readonly set of default options that will be used when constructing a new
     * Semaphore object.
     */
    static readonly DefaultOptions: SemaphoreOptions;
    /**
     * Options dictating how this semaphore will work
     */
    options: SemaphoreOptions;
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
    constructor(maxConcurrent?: number, options?: SemaphoreOptions);
    /**
     * The set number of allowed concurrent users of this Semaphore
     */
    get maxConcurrent(): number;
    /**
     * Is this semaphore currently locked?
     *
     * This is true when the `maxConcurrent` users has been achieved and any
     * further aquires must wait until an existing lock is released.
     */
    get isLocked(): boolean;
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
    acquire(): Promise<SemaphoreTicket>;
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
    guard<T = any>(cb: SemaphoreLockCB<T>): Promise<T>;
    /**
     * Cancels all queued locks by rejecting their promises.
     *
     * The error returned is the one set in the options when the Semaphore was
     * constructed. This defaults to {@link ErrCancelled}.
     *
     * After cancelling, the queue, and available slots are reset.
     */
    cancelAll(): void;
}
