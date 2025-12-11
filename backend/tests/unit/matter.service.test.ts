import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

vi.mock('../../src/ticketing/matter/repo/matter_repo', () => {
  return {
    MatterRepo: vi.fn().mockImplementation(() => ({
      getMatters: vi.fn(),
      getMatterById: vi.fn(),
      updateMatterField: vi.fn(),
    })),
  };
});

vi.mock('../../src/ticketing/matter/service/cycle_time_service', () => {
  return {
    CycleTimeService: vi.fn().mockImplementation(() => ({
      calculateCycleTimeAndSLA: vi.fn(),
    })),
  };
});

import { MatterRepo } from '../../src/ticketing/matter/repo/matter_repo';
import { CycleTimeService } from '../../src/ticketing/matter/service/cycle_time_service';
import { MatterService } from '../../src/ticketing/matter/service/matter_service';

describe('MatterService', () => {
  let service: MatterService;
  let mockRepo: { getMatters: Mock; getMatterById: Mock; updateMatterField: Mock };
  let mockCycle: { calculateCycleTimeAndSLA: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      getMatters: vi.fn(),
      getMatterById: vi.fn(),
      updateMatterField: vi.fn(),
    };

    mockCycle = {
      calculateCycleTimeAndSLA: vi.fn(),
    };

    // Still gross - I have a new appreciation for dependency injection
    (MatterRepo as unknown as Mock).mockReturnValue(mockRepo);
    (CycleTimeService as unknown as Mock).mockReturnValue(mockCycle);

    service = new MatterService();
  });

  describe('getMatters', () => {
    it('Should return paginated list of enriched matters', async () => {
      mockRepo.getMatters.mockResolvedValue({
        total: 1,
        matters: [
          {
            id: '1',
            subject: 'Test',
            fields: {
              Status: { value: { groupName: 'Done' } },
            },
          },
        ],
      });

      mockCycle.calculateCycleTimeAndSLA.mockResolvedValue({
        cycleTime: { resolutionTimeMs: 5000 },
        sla: 'Met',
      });

      const result = await service.getMatters({ page: 1, limit: 25 });

      expect(mockRepo.getMatters).toHaveBeenCalled();
      expect(mockCycle.calculateCycleTimeAndSLA).toHaveBeenCalledWith('1', 'Done');

      expect(result.data[0]).toHaveProperty('cycleTime');
      expect(result.data[0].sla).toBe('Met');
    });
  });

  describe('getMatterById', () => {
    it('enriches matter with cycle time and SLA', async () => {
      mockRepo.getMatterById.mockResolvedValue({
        id: '110',
        fields: {
          Status: { value: { groupName: 'Done' } },
        },
      });

      mockCycle.calculateCycleTimeAndSLA.mockResolvedValue({
        cycleTime: { resolutionTimeMs: 100000 },
        sla: 'Met',
      });

      const result = await service.getMatterById('110');

      expect(result?.cycleTime?.resolutionTimeMs).toBe(100000);
      expect(result?.sla).toBe('Met');
    });

    it('returns null when matter not found', async () => {
      mockRepo.getMatterById.mockResolvedValue(null);

      const result = await service.getMatterById('missingId');

      expect(result).toBeNull();
    });
  });

  describe('updateMatter', () => {
    it('delegates arguments correctly to the repo', async () => {
      await service.updateMatter('1', 'field123', 'text', 'Hello', 42);

      expect(mockRepo.updateMatterField).toHaveBeenCalledWith('1', 'field123', 'text', 'Hello', 42);
    });
  });
});
