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
/**
 * Function which when called releases the lock it originated from
 */
export declare type Releaser = () => void;
/**
 * Type for the promise resolvers
 */
export declare type LockResolver = (release: Releaser) => void;
/**
 * Type for the promise rejectors
 */
export declare type LockRejector = (err: Error) => void;
/**
 * Extendable object mapping the resolver/rejector pair from promises
 */
export interface QueuedPromise<Resolver = LockResolver, Rejector = LockRejector> {
    resolve: Resolver;
    reject: Rejector;
}
