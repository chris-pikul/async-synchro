"use strict";
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
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Mutex_instances, _Mutex_locked, _Mutex_queue, _Mutex_enque, _Mutex_deque, _Mutex_makeReleaser;
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("./errors");
;
/**
 * Single-user concurrency lock. Only allows one lock at a time.
 */
class Mutex {
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
    constructor(options) {
        _Mutex_instances.add(this);
        /**
         * Determines if there is an active lock on this Mutex
         */
        _Mutex_locked.set(this, void 0);
        /**
         * Queue of locks waiting on this Mutex
         */
        _Mutex_queue.set(this, void 0);
        // Bind methods
        this.lock = this.lock.bind(this);
        this.guard = this.guard.bind(this);
        this.cancelAll = this.cancelAll.bind(this);
        // Assign the options by overloading the defaults with a spread
        this.options = Object.assign({}, (options !== null && options !== void 0 ? options : {}));
        // Ensure we are unlocked at the beginning
        __classPrivateFieldSet(this, _Mutex_locked, false, "f");
        __classPrivateFieldSet(this, _Mutex_queue, [], "f");
    }
    /**
     * Is this Mutex currently locked?
     */
    get isLocked() {
        return __classPrivateFieldGet(this, _Mutex_locked, "f");
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
    lock() {
        const wasLocked = this.isLocked;
        // eslint-disable-next-line no-promise-executor-return
        const prom = new Promise((res, rej) => __classPrivateFieldGet(this, _Mutex_instances, "m", _Mutex_enque).call(this, res, rej));
        if (!wasLocked) {
            // If we wanted to listen, fire off an event
            if (typeof this.options.onLock === 'function')
                this.options.onLock();
            __classPrivateFieldGet(this, _Mutex_instances, "m", _Mutex_deque).call(this);
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
    async guard(cb) {
        // Perform the standard locking
        const release = await this.lock();
        // Setup a variable for the return results
        let value;
        try {
            // Use the callback as an async function
            value = await cb();
        }
        finally {
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
    cancelAll(err) {
        // Reject all of the waiting promises and empty the queue
        __classPrivateFieldGet(this, _Mutex_queue, "f").forEach(({ reject }) => { var _a; return reject((_a = err !== null && err !== void 0 ? err : this.options.errorCancelled) !== null && _a !== void 0 ? _a : errors_1.ErrCancelled); });
        __classPrivateFieldSet(this, _Mutex_queue, [], "f");
        // Unlock the mutex
        __classPrivateFieldSet(this, _Mutex_locked, false, "f");
        // Fire the event is asked for
        if (typeof this.options.onCancel === 'function')
            this.options.onCancel();
    }
}
exports.default = Mutex;
_Mutex_locked = new WeakMap(), _Mutex_queue = new WeakMap(), _Mutex_instances = new WeakSet(), _Mutex_enque = function _Mutex_enque(resolve, reject) {
    // By adding to the queue we are locking by nature
    __classPrivateFieldSet(this, _Mutex_locked, true, "f");
    // Add to the end of the queue the promise functions
    __classPrivateFieldGet(this, _Mutex_queue, "f").push({
        resolve,
        reject,
    });
}, _Mutex_deque = function _Mutex_deque() {
    // Grab the next queued promise if one is available
    const next = __classPrivateFieldGet(this, _Mutex_queue, "f").shift();
    if (!next)
        return;
    // If we wanted to listen, fire off an event
    if (typeof this.options.onLock === 'function')
        this.options.onLock();
    // Resolve the promise to pass through the releaser
    next.resolve(__classPrivateFieldGet(this, _Mutex_instances, "m", _Mutex_makeReleaser).call(this));
}, _Mutex_makeReleaser = function _Mutex_makeReleaser() {
    // Cache the released state
    let released = false;
    return () => {
        // Short-circuit out if already released
        if (released)
            return;
        released = true;
        // Fire off the event if we are listening
        if (typeof this.options.onRelease === 'function')
            this.options.onRelease();
        // If there is queued promises, let them process. Otherwise unlock
        if (__classPrivateFieldGet(this, _Mutex_queue, "f").length > 0)
            __classPrivateFieldGet(this, _Mutex_instances, "m", _Mutex_deque).call(this);
        else
            __classPrivateFieldSet(this, _Mutex_locked, false, "f");
    };
};
//# sourceMappingURL=mutex.js.map