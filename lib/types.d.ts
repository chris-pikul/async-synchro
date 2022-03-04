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
export declare type Releaser = () => void;
export declare type Canceller = () => void;
export declare type LockTicket = [Releaser, number?];
export declare type LockResolver = (ticket: LockTicket) => void;
export declare type LockRejector = (err: Error) => void;
export declare type LockCB<T> = (locks?: number) => (Promise<T> | T);
export interface QueuedPromise {
    resolve: LockResolver;
    reject: LockRejector;
}
