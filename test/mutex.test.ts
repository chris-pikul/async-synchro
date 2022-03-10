import { expect } from 'chai';
import { describe } from 'mocha';
import * as FakeTimers from '@sinonjs/fake-timers';

import Mutex from '../src/mutex';
import { Releaser } from '../src/types';
import { ErrCancelled } from '../src/errors';

describe('Mutex', () => {
  describe('Lock', () => {
    const clock = FakeTimers.createClock();

    it('immediately fires and releases on first lock', async () => {
      const mtx = new Mutex();

      const release = await mtx.lock();

      expect(mtx.isLocked).to.be.true;

      release();

      expect(mtx.isLocked).to.be.false;
    });
    
    it('blocks future calls until the first is unlocked', async () => {
      const mtx = new Mutex();

      const vals:number[] = [];

      let firstRel:Releaser = () => {};
      mtx.lock().then(rel => {
        vals.push(1);
        firstRel = rel;
      });

      let secondRel:Releaser = () => {};
      mtx.lock().then(rel => {
        vals.push(2);
        secondRel = rel;
      });

      let thirdRel:Releaser = () => {};
      mtx.lock().then(rel => {
        vals.push(3);
        thirdRel = rel;
      });

      expect(vals, 'values should be empty').to.eql([]);
      expect(mtx.isLocked, 'starts locked').to.be.true;
      
      await clock.tickAsync(0);

      expect(vals, 'first promise resolved').to.eql([ 1 ]);
      expect(mtx.isLocked, 'still locked after first tick').to.be.true;
      
      firstRel();
      await clock.tickAsync(0);

      expect(vals, 'second promise resolved').to.eql([ 1, 2 ]);
      expect(mtx.isLocked, 'still after second tick').to.be.true;

      secondRel();
      await clock.tickAsync(0);

      expect(vals, 'third promise resolved').to.eql([ 1, 2, 3 ]);
      expect(mtx.isLocked, 'still after third tick').to.be.true;

      thirdRel();
      await clock.tickAsync(0);

      expect(mtx.isLocked, 'release after all others').to.be.false;
    });

    const testCancel = async (mtx:Mutex, errExpected:Error) => {
      let cancelled = false;

      mtx.lock().then(() => {})
        .catch(err => {
          throw new Error('first lock should not cancel');
        });

      mtx.lock().then(() => {})
        .catch(err => {
          if(err === errExpected)
            cancelled = true;
          else
            throw new Error('incorrect error thrown');
        });

      await clock.tickAsync(0);

      expect(mtx.isLocked, 'locked at first').to.be.true;
      expect(cancelled, 'not cancelled at first').to.be.false;

      mtx.cancelAll();
      await clock.tickAsync(0);

      expect(cancelled, 'catches got executed').to.be.true;
      expect(mtx.isLocked, 'no longer locked').to.be.false;
    };

    it('allows locks to be cancelled (with default error)', async () => {
      let firedOnCancel = false;
      const mtx = new Mutex({
        onCancel: () => {
          firedOnCancel = true;
        },
      });

      await testCancel(mtx, ErrCancelled);

      expect(firedOnCancel, 'fired onCancel').to.be.true;
    });

    it('allows locks to be cancelled (error set in options)', async () => {
      const error = new Error('custom cancel');

      let firedOnCancel = false;
      const mtx = new Mutex({
        errorCancelled: error,

        onCancel: () => {
          firedOnCancel = true;
        },
      });

      await testCancel(mtx, error);

      expect(firedOnCancel, 'fired onCancel').to.be.true;
    });

    it('fires onLock/onRelease when specified in options', async () => {
      let firedOnLock = false;
      let firedOnRelease = false;
      
      const mtx = new Mutex({
        onLock: () => {
          firedOnLock = true;
        },
        onRelease: () => {
          firedOnRelease = true;
        },
      });

      const release = await mtx.lock();

      expect(firedOnLock, 'fired onLock').to.be.true;

      release();
      await clock.tickAsync(0);

      expect(firedOnRelease, 'fired onRelease').to.be.true;
    });
  });

  describe('Lock Guard', () => {
    const clock = FakeTimers.createClock();

    it('performs the releasing automatically', async () => {
      const mtx = new Mutex();

      let guardCalled = false;
      const prom = mtx.guard<number>(() => {
        guardCalled = true;
        return 1;
      });

      expect(guardCalled, 'guard should not have executed yet').to.be.false;
      expect(mtx.isLocked, 'mutex should start locked').to.be.true;

      const ret = await prom;

      expect(guardCalled, 'guard should have been called').to.be.true;
      expect(mtx.isLocked, 'mutex should have released').to.be.false;
      expect(ret, 'returned value').to.equal(1);
    });
  });
});
