import { expect } from 'chai';
import { describe } from 'mocha';
import * as FakeTimers from '@sinonjs/fake-timers';

import Mutex from '../src/mutex';

describe('Mutex', () => {
  describe('Lock', () => {
    const clock = FakeTimers.createClock();
    
    it('blocks future calls until the first is unlocked', async () => {
      const mtx = new Mutex();

      const vals:number[] = [];

      mtx.lock().then(rel => {
        vals.push(1);
        rel();
      });

      mtx.lock().then(rel => {
        vals.push(2);
        rel();
      });

      mtx.lock().then(rel => {
        vals.push(3);
        rel();
      });

      expect(vals, 'values should be empty').to.eql([]);
      expect(mtx.isLocked, 'starts locked').to.be.true;
      
      await clock.tickAsync(0);

      expect(vals, 'first promise resolved').to.eql([ 1 ]);
      expect(mtx.isLocked, 'still locked after first tick').to.be.true;
      
      await clock.tickAsync(0);

      expect(vals, 'second promise resolved').to.eql([ 1, 2 ]);
      expect(mtx.isLocked, 'now unlocked after second tick').to.be.false;
    });
  });
});
