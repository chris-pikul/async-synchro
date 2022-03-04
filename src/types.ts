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
export type Releaser = () => void;

export type Canceller = () => void;

export type LockTicket = [ Releaser, number? ];

export type LockResolver = (ticket:LockTicket) => void;

export type LockRejector = (err:Error) => void;

export type LockCB<T> = (locks?:number) => (Promise<T> | T);

export interface QueuedPromise {
  resolve:LockResolver;
  reject:LockRejector;
};
