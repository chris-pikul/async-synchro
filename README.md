# async-synchro

Synchronization for concurrency. Allows for mutex, semaphores, read-write locks, timed locks, and more.

**WORK IN PROGRESS**
This readme reflects what is currently implemented

## Installation

Standard NPM package allowing for CommonJS/ESM import styles.

```terminal
npm install --save async-synchro
yarn add async-synchro
```

## Usage

Each type follows a similar pattern, the verbage may be slightly different between whichever class you use. I prefer the Async/Await flavor of usage personally, but if you prefer Promises examples are available for those as well.

The doc-comments on each type are extensive and will provide you with examples as well if you have auto-complete/intellisense.

### Semaphore - Multi-user locks

Semaphores allow for 1 or more active locks to be acquired on them. When the maximum number of concurrent users is achieved, additional lock attempts will wait until an acquisition is available.

There are two ways to acquire a lock. The first and highly suggested way is with automatic lock/unlock with the `guard()` method. The second is with manual locking and unlocking via `acquire()`.

If you prefer the manual lock/release pattern of `acquire()` then be-aware that you **must call the release function**. Bad things will happen if you don't.

#### Automatically lock/release with Async/Await

```TypeScript
// Create semaphore with up to 5 concurrent users
const sem = new Semaphore(5);

try {
  const results = await sem.guard<number>(available => {
    // At this point the lock is acquired and work can be performed
    ...

    // You can return a value if you wish, which will be passed through.
    return 42;
  });
} catch(err) {
  // Most likely, the Semaphore was cancelled and the
  // locks where errored out.
  console.error(err.message);
}
```

#### Automatically lock/release with Promises

```TypeScript
// Create semaphore with up to 5 concurrent users
const sem = new Semaphore(5);

sem.guard<number>()
  .then(available => {
    // At this point the lock is acquired and work can be performed
    ...

    // You can return a value if you wish, which will be passed through.
    return 42;
  })
  .then(results => {
    console.log(results); // 42
  })
  .catch(err => {
    // Most likely, the Semaphore was cancelled and the
    // locks where errored out.
    console.error(err.message);
  });
```

#### Manually acquiring lock with Async/Await

```JS
// Create semaphore with up to 5 concurrent users
const sem = new Semaphore(5);

try {
  // "release" is the releaser that unlocks or releases this lock.
  // "available" is the number of additional locks that can be acquired.
  const [ release, available ] = await sem.acquire();

  // At this point the lock is acquired and work can be performed
  ...

  // You must ALWAYS call the releaser when using acquire()!
  release();
} catch(err) {
  // Most likely, the Semaphore was cancelled and the
  // locks where errored out.
  console.error(err.message);
}
```

#### Manually acquiring lock with Promises

```JS
// Create semaphore with up to 5 concurrent users
const sem = new Semaphore(5);

// Try to acquire the lock, or wait until available
sem.acquire()
  .then((release, available) => {
    // At this point the lock is acquired and work can be performed
    ...

    // You must ALWAYS call the releaser when using acquire()!
    release();
  })
  .catch(err => {
    // Most likely, the Semaphore was cancelled and the
    // locks where errored out.
    console.error(err.message);
  })
```

## Motivation

I liked the other libraries for this type of operation, but I felt like their TypeScript support was a second-thought, or the commenting of their code wasn't really up to my personal standards. Additionally, some features I really wanted wheren't implemented in them by standard. So I decided to write my own.

Either way big thanks to [DirtyHairy/async-mutex](https://github.com/DirtyHairy/async-mutex) for the main code. The `Semaphore` class is a direct rewrite of their implementation for the most part.

## License

MIT License

Copyright (c) 2022 Chris Pikul

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.