import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock pool + client
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock('../../src/db/pool', () => ({
  default: { connect: vi.fn(() => mockClient) },
}));
import { MatterRepo } from '../../src/ticketing/matter/repo/matter_repo';

describe('MatterRepo', () => {
  let repo: MatterRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new MatterRepo();
  });

  describe('getMatters', () => {
    it('returns empty result when there are no searchIds', async () => {
      // @ts-ignore mock private method
      vi.spyOn(repo, 'getSearchIds').mockResolvedValue([]);

      const result = await repo.getMatters({ search: 'abc' });
      expect(mockClient.query).not.toBeCalled();
      expect(result).toEqual({ matters: [], total: 0 });
    });

    it('returns paginated matters and total', async () => {
      // Fake search IDs to avoid early exit
      // @ts-ignore
      vi.spyOn(repo, 'getSearchIds').mockResolvedValue(['1', '2']);

      // Fake count query
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // count
        .mockResolvedValueOnce({
          rows: [
            { id: '1', board_id: 'B1', created_at: '2025', updated_at: '2025' },
            { id: '2', board_id: 'B1', created_at: '2025', updated_at: '2025' },
          ],
        });

      // @ts-ignore
      vi.spyOn(repo, 'getMatterFields').mockResolvedValue({ foo: 'bar' });

      const result = await repo.getMatters({ page: 1, limit: 25, search: 'abc' });

      expect(result.total).toBe(2);
      expect(result.matters.length).toBe(2);
      expect(result.matters[0]).toEqual({
        id: '1',
        boardId: 'B1',
        createdAt: '2025',
        updatedAt: '2025',
        fields: { foo: 'bar' },
      });
    });
  });

  describe('getMatterById', () => {
    it('returns null when not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.getMatterById('123');
      expect(result).toBeNull();
    });

    it('returns matter with fields', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: '123', board_id: 'B1', created_at: '2025', updated_at: '2025' }],
      });

      // @ts-ignore
      vi.spyOn(repo, 'getMatterFields').mockResolvedValue({ x: 'y' });

      const result = await repo.getMatterById('123');
      expect(result?.id).toBe('123');
      expect(result?.fields).toEqual({ x: 'y' });
    });
  });

  describe('getTicketQueryTime', () => {
    it('returns null if no results', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.getTicketQueryTime('1');
      expect(result).toBeNull();
    });

    it('returns row from cycle time query', async () => {
      const fakeRow = { ticket_id: '1', cycle_time_to_done: 5000 };
      mockClient.query.mockResolvedValueOnce({ rows: [fakeRow] });

      const result = await repo.getTicketQueryTime('1');
      expect(result).toEqual(fakeRow);
    });
  });
});
