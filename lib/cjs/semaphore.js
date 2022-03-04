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
var _Semaphore_instances, _Semaphore_maxConcurrent, _Semaphore_options, _Semaphore_allowed, _Semaphore_queue, _Semaphore_enque, _Semaphore_dispatch;
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("./errors");
;
/**
 * Semaphore for allowing a number of concurrent locks.
 */
class Semaphore {
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
    constructor(maxConcurrent, options) {
        _Semaphore_instances.add(this);
        /**
         * Maximum number of concurrent
         */
        _Semaphore_maxConcurrent.set(this, 1);
        /**
         * Options dictating how this semaphore will work
         */
        _Semaphore_options.set(this, void 0);
        /**
         * Numerical value determining how many further locks are allowed.
         *
         * Instantiated at the value of maxConcurrents and decremented for each lock
         * aquired. As long as this value is positive, further lock aquisitions will
         * be passed through unabated. When this value reaches 0, further locks must
         * wait until an existing lock is released.
         */
        _Semaphore_allowed.set(this, void 0);
        /**
         * List of locks aquired on this Semaphore.
         */
        _Semaphore_queue.set(this, []);
        // Bind methods
        this.acquire = this.acquire.bind(this);
        this.guard = this.guard.bind(this);
        // Ensure the maxConcurrent is a number at least 1 if provided
        if (maxConcurrent) {
            if (typeof maxConcurrent !== 'number')
                throw new TypeError(`Semaphore was constructed with a maxConcurrent of type "${typeof maxConcurrent}", a positive number is required`);
            else if (maxConcurrent <= 0)
                throw new TypeError(`Semaphore was constructed with a maxConcurrent value below 1 "${maxConcurrent}", only positive values are supported`);
            __classPrivateFieldSet(this, _Semaphore_maxConcurrent, Math.trunc(maxConcurrent), "f");
        }
        else {
            __classPrivateFieldSet(this, _Semaphore_maxConcurrent, 1, "f");
        }
        // Assign the options by overloading the defaults with a spread
        __classPrivateFieldSet(this, _Semaphore_options, Object.assign(Object.assign({}, Semaphore.DefaultOptions), (options !== null && options !== void 0 ? options : {})), "f");
        // Initiate the allowed value for tracking lock numbers
        __classPrivateFieldSet(this, _Semaphore_allowed, __classPrivateFieldGet(this, _Semaphore_maxConcurrent, "f"), "f");
    }
    /**
     * The set number of allowed concurrent users of this Semaphore
     */
    get maxConcurrent() {
        return __classPrivateFieldGet(this, _Semaphore_maxConcurrent, "f");
    }
    /**
     * Is this semaphore currently locked?
     *
     * This is true when the `maxConcurrent` users has been achieved and any
     * further aquires must wait until an existing lock is released.
     */
    get isLocked() {
        return (__classPrivateFieldGet(this, _Semaphore_allowed, "f") <= 0);
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
    acquire() {
        // Cache the lock status since the promise resolution might change it
        const wasLocked = this.isLocked;
        // Construct the returning promise
        const prom = new Promise(__classPrivateFieldGet(this, _Semaphore_instances, "m", _Semaphore_enque));
        // If there was no lock, start dispatching the queue
        if (!wasLocked)
            __classPrivateFieldGet(this, _Semaphore_instances, "m", _Semaphore_dispatch).call(this);
        // If we wanted to listen, fire of an event
        if (__classPrivateFieldGet(this, _Semaphore_options, "f").onAquire)
            __classPrivateFieldGet(this, _Semaphore_options, "f").onAquire();
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
    async guard(cb) {
        const [release, avail] = await this.acquire();
        let value;
        try {
            value = await cb(avail);
        }
        finally {
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
    cancelAll() {
        // Reject each of the waiting promises in the queue and empty it
        __classPrivateFieldGet(this, _Semaphore_queue, "f").forEach(({ reject }) => { var _a; return reject((_a = __classPrivateFieldGet(this, _Semaphore_options, "f").errorCancelled) !== null && _a !== void 0 ? _a : errors_1.ErrCancelled); });
        __classPrivateFieldSet(this, _Semaphore_queue, [], "f");
        // Reset the allowed value for better concurrent
        __classPrivateFieldSet(this, _Semaphore_allowed, __classPrivateFieldGet(this, _Semaphore_maxConcurrent, "f"), "f");
    }
}
exports.default = Semaphore;
_Semaphore_maxConcurrent = new WeakMap(), _Semaphore_options = new WeakMap(), _Semaphore_allowed = new WeakMap(), _Semaphore_queue = new WeakMap(), _Semaphore_instances = new WeakSet(), _Semaphore_enque = function _Semaphore_enque(resolve, reject) {
    __classPrivateFieldGet(this, _Semaphore_queue, "f").push({
        resolve,
        reject,
    });
}, _Semaphore_dispatch = function _Semaphore_dispatch() {
    // Grab the first enqueued entry in the line, or short-circuit if none
    const next = __classPrivateFieldGet(this, _Semaphore_queue, "f").shift();
    if (!next)
        return;
    // Save the released state for the releaser
    let released = false;
    // Make the releaser function for resolving
    const releaser = () => {
        var _a;
        // Shortcut out if already released
        if (released)
            return;
        released = true;
        // Increment available slots
        __classPrivateFieldSet(this, _Semaphore_allowed, (_a = __classPrivateFieldGet(this, _Semaphore_allowed, "f"), _a++, _a), "f");
        // If we wanted to listen, fire of the event
        if (__classPrivateFieldGet(this, _Semaphore_options, "f").onRelease)
            __classPrivateFieldGet(this, _Semaphore_options, "f").onRelease();
        // Recursivly dispatch the next lock
        __classPrivateFieldGet(this, _Semaphore_instances, "m", _Semaphore_dispatch).call(this);
    };
    // Construct the ticket tuple
    const ticket = [releaser, __classPrivateFieldGet(this, _Semaphore_maxConcurrent, "f") - __classPrivateFieldGet(this, _Semaphore_allowed, "f")];
    // Resolve the waiting promise
    next.resolve(ticket);
};
/**
 * Readonly set of default options that will be used when constructing a new
 * Semaphore object.
 */
Semaphore.DefaultOptions = { errorCancelled: errors_1.ErrCancelled };
//# sourceMappingURL=semaphore.js.map