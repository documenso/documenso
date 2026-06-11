import { describe, expect, it } from 'vitest';

import { getSeatSyncPlan } from './billing';

describe('getSeatSyncPlan', () => {
  describe('grow', () => {
    it('skips the sync when the new seat count is below the paid seat count', () => {
      expect(getSeatSyncPlan({ mode: 'grow', paidSeatCount: 10, newSeatCount: 9 })).toEqual({
        shouldSync: false,
      });
    });

    it('skips the sync when the new seat count equals the paid seat count', () => {
      expect(getSeatSyncPlan({ mode: 'grow', paidSeatCount: 10, newSeatCount: 10 })).toEqual({
        shouldSync: false,
      });
    });

    it('invoices immediately when the new seat count exceeds the paid seat count', () => {
      expect(getSeatSyncPlan({ mode: 'grow', paidSeatCount: 10, newSeatCount: 11 })).toEqual({
        shouldSync: true,
        prorationBehaviour: 'always_invoice',
      });
    });

    it('invoices immediately on the first seat above a single paid seat', () => {
      expect(getSeatSyncPlan({ mode: 'grow', paidSeatCount: 1, newSeatCount: 2 })).toEqual({
        shouldSync: true,
        prorationBehaviour: 'always_invoice',
      });
    });
  });

  describe('reconcile', () => {
    it('syncs downward without prorations so no credits are issued', () => {
      expect(getSeatSyncPlan({ mode: 'reconcile', paidSeatCount: 10, newSeatCount: 7 })).toEqual({
        shouldSync: true,
        prorationBehaviour: 'none',
      });
    });

    it('syncs upward without prorations so drift is healed without retroactive charges', () => {
      expect(getSeatSyncPlan({ mode: 'reconcile', paidSeatCount: 10, newSeatCount: 12 })).toEqual({
        shouldSync: true,
        prorationBehaviour: 'none',
      });
    });

    it('syncs at equal counts so a drifted stripe quantity is still corrected', () => {
      expect(getSeatSyncPlan({ mode: 'reconcile', paidSeatCount: 10, newSeatCount: 10 })).toEqual({
        shouldSync: true,
        prorationBehaviour: 'none',
      });
    });
  });

  describe('unlimited sentinel', () => {
    it('never syncs in grow mode when the paid seat count is the unlimited sentinel (0)', () => {
      expect(getSeatSyncPlan({ mode: 'grow', paidSeatCount: 0, newSeatCount: 5 })).toEqual({
        shouldSync: false,
      });
    });

    it('never syncs in reconcile mode when the paid seat count is the unlimited sentinel (0)', () => {
      expect(getSeatSyncPlan({ mode: 'reconcile', paidSeatCount: 0, newSeatCount: 5 })).toEqual({
        shouldSync: false,
      });
    });
  });
});
