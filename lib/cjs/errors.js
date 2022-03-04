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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrCancelled = exports.SynchroError = void 0;
/**
 * Wraps the default Error type into a new object SynchroError allowing for
 * additional information and type-checking during error handling.
 */
class SynchroError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SynchroError';
    }
}
exports.SynchroError = SynchroError;
;
exports.ErrCancelled = new SynchroError('lock cancelled');
//# sourceMappingURL=errors.js.map