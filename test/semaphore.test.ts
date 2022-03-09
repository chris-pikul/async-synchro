import { expect } from 'chai';
import { describe } from 'mocha';
import * as FakeTimers from '@sinonjs/fake-timers';

import Semaphore from '../src/semaphore';
import { Releaser } from '../src/types';

describe('Semaphore', () => {
  describe('Constructor', () => {
    it('sets 1 users by default', () => {
      const sem = new Semaphore();
      expect(sem.maxConcurrent).to.eql(1);
    });

    it('allows positive maxConcurrent', () => {
      const sem = new Semaphore(5);
      expect(sem.maxConcurrent).to.equal(5);
    });

    it('throws if maxConcurrent is not a number', () => {
      expect(() => new Semaphore('str' as unknown as number)).to.throw();
    });

    it('throws if maxConcurrent is negative', () => {
      expect(() => new Semaphore(0)).to.throw();
      expect(() => new Semaphore(-1)).to.throw();
    });

    it('is not locked by default', () => {
      const sem = new Semaphore();
      expect(sem.isLocked).to.be.false;
    });
  });

  describe('Acquire', () => {
    const clock = FakeTimers.createClock();

    it('acquire on empty immediately fires and sets locked', async () => {
      const sem = new Semaphore();
      
      const [ rel, avail ] = await sem.acquire();
      expect(avail).to.equal(0);
      expect(sem.isLocked).to.be.true;
      rel();

      expect(sem.isLocked).to.be.false;
    });

    it('acquire holds a second aquire properly until the first is released', async () => {
      const sem = new Semaphore();

      const lockNums:number[] = [];

      let firstRel:Releaser = () => {};
      let secondRel:Releaser = () => {};

      // Setup first lock
      sem.acquire().then(([ rel ]) => {
        firstRel = rel;
        lockNums.push(1);
      });
      expect(sem.isLocked).to.be.true;

      // Setup second lock
      sem.acquire().then(([ rel ]) => {
        secondRel = rel;
        lockNums.push(2);
      });

      // Nothing has executed yet
      expect(lockNums).to.eql([ ], 'before tick results are incorrect');

      await clock.tickAsync(0);

      // Only one has executed because it was not released
      expect(lockNums).to.eql([ 1 ], 'after tick results are incorrect');

      // Release the first
      firstRel();
      await clock.tickAsync(0);
      expect(lockNums).to.eql([ 1, 2 ], 'first release results are incorrect');
      expect(sem.isLocked).to.be.true;

      // Release the second
      secondRel();
      await clock.tickAsync(0);
      expect(lockNums).to.eql([ 1, 2 ], 'second release results are incorrect');
      expect(sem.isLocked).to.be.false;
    });

    it('allows acquire to be cancelled',async () => {
      const errCancel = new Error('custom cancel');
      
      let firedOnCancel = false;
      const sem = new Semaphore(1, {
        errorCancelled: errCancel,
        onCancel: () => {
          firedOnCancel = true;
        },
      });

      let acquired = false;
      let cancelled = false;

      // First should pass through
      sem.acquire().then(() => {
        // Do nothing
        acquired = true;
      }).catch(err => {
        throw new Error('first lock should not cancel');
      });

      // Second is waiting and should die
      sem.acquire().then(() => {})
        .catch(err => {
          if(err === errCancel)
            cancelled = true;
        });

      expect(acquired, 'first acquire').to.be.false;
      expect(cancelled, 'first cancelled').to.be.false;
      expect(sem.isLocked, 'first locked').to.be.true;

      await clock.tickAsync(0);

      expect(acquired, 'second acquire').to.be.true;
      expect(cancelled, 'second cancelled').to.be.false;
      expect(sem.isLocked, 'second locked').to.be.true;

      expect(firedOnCancel, 'has not called onCancel').to.be.false;
      sem.cancelAll();
      expect(firedOnCancel, 'has called onCancel').to.be.true;

      await clock.tickAsync(0);

      expect(cancelled, 'last cancelled').to.be.true;
    });

    it('allows first two to pass but blocks others when maxConcurrent is 2', async () => {
      const vals:number[] = [];
  
      let firstRel:Releaser = () => {};
      let secondRel:Releaser = () => {};
      let thirdRel:Releaser = () => {};
  
      const sem = new Semaphore(2);
  
      // First lock
      sem.acquire().then(([ rel ]) => {
        firstRel = rel;
        vals.push(1);
      });
  
      // Second lock
      sem.acquire().then(([ rel ]) => {
        secondRel = rel;
        vals.push(2);
      });
  
      // Third lock
      sem.acquire().then(([ rel ]) => {
        thirdRel = rel;
        vals.push(3);
      });
  
      await clock.tickAsync(0);

      expect(vals, 'allowed locks').to.eql([ 1, 2 ]);
      expect(sem.isLocked, 'remains locked').to.be.true;

      firstRel();
      await clock.tickAsync(0);

      expect(vals, 'allowed locks after first released').to.eql([ 1, 2, 3 ]);
      expect(sem.isLocked, 'remains locked after first').to.be.true;

      secondRel();
      await clock.tickAsync(0);

      expect(vals, 'allowed locks after second released').to.eql([ 1, 2, 3 ]);
      expect(sem.isLocked, 'unlocked after first two').to.be.false;

      thirdRel();
      await clock.tickAsync(0);
    });

    it('fires the onAcquire/onRelease when specified in constructor options', async () => {
      let firedOnAquire = false;
      let firedOnRelease = false;
      
      const sem = new Semaphore(1, {
        onAquire: () => {
          firedOnAquire = true;
        },
        onRelease: () => {
          firedOnRelease = true;
        },
      });

      // Simulate lock
      sem.acquire().then(([ rel ]) => rel());

      expect(firedOnAquire).to.be.true;

      // Cleanup
      await clock.tickAsync(0);
    });

    it('does not change the state if release is called more than once', async () => {
      const sem = new Semaphore();

      let secondCalled = false;
      let thirdCalled = false;
      let firstRel:Releaser = () => {};
      
      sem.acquire().then(([ rel ]) => {
        firstRel = rel;
      });

      sem.acquire().then(() => {
        secondCalled = true;
      });

      sem.acquire().then(() => {
        thirdCalled = true;
      });

      expect(secondCalled, 'init secondCalled').to.be.false;
      expect(thirdCalled, 'init thirdCalled').to.be.false;
      expect(sem.isLocked, 'init sem locked').to.be.true;

      await clock.tickAsync(0);

      expect(secondCalled, 'tick secondCalled').to.be.false;
      expect(thirdCalled, 'tick thirdCalled').to.be.false
      expect(sem.isLocked, 'tick sem locked').to.be.true;

      firstRel();
      await clock.tickAsync(0);

      expect(secondCalled, 'first secondCalled').to.be.true;
      expect(thirdCalled, 'first thirdCalled').to.be.false;
      expect(sem.isLocked, 'first sem locked').to.be.true;

      firstRel();
      await clock.tickAsync(0);

      expect(secondCalled, 'last secondCalled').to.be.true;
      expect(thirdCalled, 'last thirdCalled').to.be.false;
      expect(sem.isLocked, 'last sem locked').to.be.true;
    });
  });

  describe('Guard', () => {
    const clock = FakeTimers.createClock();

    it('allows first lock to pass by default',async () => {
      const sem = new Semaphore();

      let guardCalled = false;
      const prom = sem.guard(() => {
        guardCalled = true;
        return 1;
      });

      expect(guardCalled).to.be.false;
      expect(sem.isLocked).to.be.true;

      const ret = await prom;
      
      expect(guardCalled).to.be.true;
      expect(sem.isLocked).to.be.false;
      expect(ret, 'returned the value from cb').to.equal(1);
    });
  });
});