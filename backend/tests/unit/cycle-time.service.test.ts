import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { buildTicketTimes } from '../utils/cycle-time.utils';

//mocking the repo with self instantiation is possible but annoying - would look to refactor to the repo being passed in in constructor
vi.mock('../../src/ticketing/matter/repo/matter_repo', () => {
  return {
    MatterRepo: vi.fn().mockImplementation(() => ({
      getTicketQueryTime: vi.fn(),
    })),
  };
});

import { CycleTimeService } from '../../src/ticketing/matter/service/cycle_time_service';
import { MatterRepo } from '../../src/ticketing/matter/repo/matter_repo';

describe('CycleTimeService', () => {
  describe('calculateCycleTimeAndSLA', () => {
    let service: CycleTimeService;
    let mockRepo: { getTicketQueryTime: Mock };

    beforeEach(() => {
      vi.clearAllMocks();
      mockRepo = {
        getTicketQueryTime: vi.fn(),
      };
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
});
