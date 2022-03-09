import { expect } from 'chai';
import { describe } from 'mocha';

import SynchroError, { ErrCancelled } from '../src/errors';

describe('SynchroError', () => {
  it('constructs with name "SynchroError"', () => {
    expect(new SynchroError()).to.have.property('name', 'SynchroError');
  });

  it('allows for equating constants', () => {
    try {
      throw ErrCancelled;
    } catch(err) {
      expect(err).to.eql(ErrCancelled);
    }
  });
});
