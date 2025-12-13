import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { buildTicketTimes } from './utils/cycle-time.utils';

//mocking the repo with self instantiation is possible but annoying - would look to refactor to the repo being passed in in constructor
vi.mock('../../repo/matter_repo', () => {
  return {
    MatterRepo: vi.fn().mockImplementation(() => ({
      getTicketQueryTime: vi.fn(),
    })),
  };
});

import { CycleTimeService } from '../cycle_time_service';
import { MatterRepo } from '../../repo/matter_repo';

describe('CycleTimeService', () => {
  describe('calculateCycleTimeAndSLA', () => {
    let service: CycleTimeService;
    let mockRepo: { getTicketQueryTime: Mock };

    beforeEach(() => {
      vi.clearAllMocks();
      mockRepo = {
        getTicketQueryTime: vi.fn(),
      };
      // This is a bit gross - but it allows the new MatterRepo() in cycle time service to return our mock
      (MatterRepo as unknown as Mock).mockReturnValue(mockRepo);
      service = new CycleTimeService();
    });

    it('Calculates Cycle Time and SLA for a completed ticket - on time', async () => {
      mockRepo.getTicketQueryTime.mockResolvedValue(buildTicketTimes(1, 2));

      const result = await service.calculateCycleTimeAndSLA('fakeID', 'Done');
      expect(result.sla).toBe('Met');
      expect(result.cycleTime.resolutionTimeMs).toBe(3600000);
      expect(result.cycleTime.isInProgress).toBe(false);
      expect(result.cycleTime.resolutionTimeFormatted).toBe('1h');
    });

    it('Calculates Cycle Time and SLA for completed ticket - breached', async () => {
      mockRepo.getTicketQueryTime.mockResolvedValue(buildTicketTimes(8.5, 10.5));

      const result = await service.calculateCycleTimeAndSLA('fakeID', 'Done');
      expect(result.sla).toBe('Breached');
      expect(result.cycleTime.resolutionTimeMs).toBe(30600000);
      expect(result.cycleTime.isInProgress).toBe(false);
      expect(result.cycleTime.resolutionTimeFormatted).toBe('8h 30m');
    });

    it('Calculates Cycle Time and SLA for completed ticket - In Progress', async () => {
      mockRepo.getTicketQueryTime.mockResolvedValue(buildTicketTimes(null, 1));

      const result = await service.calculateCycleTimeAndSLA('fakeID', 'In Progress');
      expect(result.sla).toBe('In Progress');
      expect(result.cycleTime.resolutionTimeMs).toBe(0);
      expect(result.cycleTime.isInProgress).toBe(true);
      expect(result.cycleTime.resolutionTimeFormatted).toBe('In Progress: 1h');
    });

    it('Calculates Cycle Time and SLA for completed ticket - In Progress/Overdue', async () => {
      mockRepo.getTicketQueryTime.mockResolvedValue(buildTicketTimes(null, 10000));

      const result = await service.calculateCycleTimeAndSLA('fakeID', 'In progress');
      expect(result.sla).toBe('In Progress');
      expect(result.cycleTime.resolutionTimeMs).toBe(0);
      expect(result.cycleTime.isInProgress).toBe(true);
      expect(result.cycleTime.resolutionTimeFormatted).toBe('In Progress: 5d+');
    });
  });

  describe('_formatDuration', () => {
    let service: CycleTimeService;

    beforeEach(() => {
      service = new CycleTimeService();
    });

    it('formats durations correctly for completed tickets', () => {
      // bit of a hack to access private method but I'm okay with it for testing
      const result = (service as any)._formatDuration(3600000, false);
      expect(result).toBe('1h');
    });

    it('formats durations correctly for in-progress tickets', () => {
      const result = (service as any)._formatDuration(3600000, true);
      expect(result).toBe('In Progress: 1h');
    });

    it('formats durations >5 days as 5d+', () => {
      const ms = 6 * 24 * 60 * 60 * 1000;
      const result = (service as any)._formatDuration(ms, false);
      expect(result).toBe('5d+');
    });

    it('handles 1 day 3 hours 5 minutes', () => {
      const ms = (1 * 24 * 60 * 60 + 3 * 60 * 60 + 5 * 60) * 1000;
      const result = (service as any)._formatDuration(ms, false);
      expect(result).toBe('1d 3h');
    });

    it('formats 10 minutes 59 seconds', () => {
      const ms = (10 * 60 + 59) * 1000;
      const result = (service as any)._formatDuration(ms, false);
      expect(result).toBe('10m 59s');
    });

    it('formats 23 hours 42 minutes', () => {
      const ms = (23 * 60 * 60 + 42 * 60) * 1000;
      const result = (service as any)._formatDuration(ms, false);
      expect(result).toBe('23h 42m');
    });

    it('formats 23 hours 10 seconds', () => {
      const ms = (23 * 60 * 60 + 10) * 1000;
      const result = (service as any)._formatDuration(ms, false);
      expect(result).toBe('23h 10s');
    });

    it('in-progress format for 23 hours 10 seconds', () => {
      const ms = (23 * 60 * 60 + 10) * 1000;
      const result = (service as any)._formatDuration(ms, true);
      expect(result).toBe('In Progress: 23h 10s');
    });
  });

  describe('_formatSLAText', () => {
    let service: CycleTimeService;

    beforeEach(() => {
      service = new CycleTimeService();
    });

    it('returns "In Progress" if duration is 0', () => {
      const result = (service as any)._formatSLAText(0);
      expect(result).toBe('In Progress');
    });

    it('returns "Met" if duration <= SLA threshold', () => {
      const thresholdMs = (service as any)._slaThresholdMs;
      const result = (service as any)._formatSLAText(thresholdMs);
      expect(result).toBe('Met');
    });

    it('returns "Breached" if duration > SLA threshold', () => {
      const thresholdMs = (service as any)._slaThresholdMs;
      const result = (service as any)._formatSLAText(thresholdMs + 1);
      expect(result).toBe('Breached');
    });
  });
});
