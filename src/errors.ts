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
 * Wraps the default Error type into a new object SynchroError allowing for
 * additional information and type-checking during error handling.
 */
export class SynchroError extends Error {
  constructor(message?:string) {
    super(message);

    this.name = 'SynchroError';
  }
};
