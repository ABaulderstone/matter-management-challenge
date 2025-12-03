import { config } from '../../../utils/config.js';
import { SLAStatus, CycleTime } from '../../types.js';
import MatterRepo from '../repo/matter_repo.js';
import logger from '../../../utils/logger.js';

/**
 * CycleTimeService - Calculate resolution times and SLA status for matters
 *
 * TODO: Implement this service to:
 * 1. Calculate resolution time from "To Do" → "Done" status transitions
 * 2. Determine SLA status based on resolution time vs threshold
 * 3. Format durations in human-readable format (e.g., "2h 30m", "3d 5h")
 *
 * Requirements:
 * - Query ticketing_cycle_time_histories table
 * - Join with status groups to identify "To Do", "In Progress", "Done" statuses
 * - Calculate time between first transition and "Done" transition
 * - For in-progress matters, calculate time from first transition to now
 * - Compare against SLA_THRESHOLD_HOURS (default: 8 hours)
 *
 * SLA Status Logic:
 * - "In Progress": Matter not yet in "Done" status
 * - "Met": Resolved within threshold (≤ 8 hours)
 * - "Breached": Resolved after threshold (> 8 hours)
 *
 * Consider:
 * - Performance for 10,000+ matters
 * - Caching strategies for high load
 * - Database query optimization
 */
export class CycleTimeService {
  // SLA threshold in milliseconds (candidates will use this in their implementation)
  private _slaThresholdMs: number;
  private matterRepo: MatterRepo;

  constructor() {
    this._slaThresholdMs = config.SLA_THRESHOLD_HOURS * 60 * 60 * 1000;
    this.matterRepo = new MatterRepo();
  }

  async calculateCycleTimeAndSLA(
    _ticketId: string,
    _currentStatusGroupName: string | null,
  ): Promise<{ cycleTime: CycleTime; sla: SLAStatus }> {
    // TODO: Implement cycle time calculation
    // See requirements in class documentation above

    // Placeholder return - replace with actual implementation

    const data = await this.matterRepo.getTicketQueryTime(_ticketId);
    return {
      cycleTime: {
        resolutionTimeMs: +data.cycle_time_to_done,
        resolutionTimeFormatted: data.first_done_at
          ? this._formatDuration(data.first_done_at, false)
          : this._formatDuration(data.first_transition_at, true),
        isInProgress: !!data.first_done_at,
        startedAt: data.first_transition_at,
        completedAt: data.first_done_at,
      },
      sla: 'In Progress',
    };
  }

  // Helper method for formatting durations (candidates will implement this)
  private _formatDuration(_durationMs: number, _isInProgress: boolean): string {
    // for readability rather than neccesity
    const msInSecond = 1000;
    const msInMinute = msInSecond * 60;
    const msInHour = msInMinute * 60;
    const msInDay = 24 * msInHour;
    const d = Math.floor(_durationMs / msInDay);
    let remainder = _durationMs % msInDay;
    const h = Math.floor(remainder / msInHour);
    remainder %= msInHour;
    const m = Math.floor(remainder / msInMinute);
    remainder %= msInMinute;
    const s = Math.floor(remainder / msInSecond);
    // probably no need to be accurate to ms

    const [largestUnit, nextUnit] = Object.entries({ d, h, m, s }).filter((entry) => entry[1] > 0);

    return `${_isInProgress ? 'In Progress' : ''} ${largestUnit[1]}${largestUnit[0]} ${nextUnit[1]}${nextUnit[0]}`;
  }
}

export default CycleTimeService;
