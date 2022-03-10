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
export default class SynchroError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SynchroError';
    }
}
;
export const ErrCancelled = new SynchroError('lock cancelled');
//# sourceMappingURL=errors.js.map