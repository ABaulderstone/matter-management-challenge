export function buildTicketTimes(hoursToDone: number | null, hoursToNow: number) {
  //   fixed time to avoid timezone issues in tests
  const NOW = new Date('2025-01-01T12:00:00Z');

  const toMs = (h: number) => h * 60 * 60 * 1000;

  return {
    cycle_time_to_done: hoursToDone !== null ? `${toMs(hoursToDone)}` : null,
    cycle_time_to_now: `${toMs(hoursToNow)}`,
    first_transition_at: new Date(NOW.getTime() - toMs(hoursToNow)).toISOString(),
    first_done_at:
      hoursToDone !== null ? new Date(NOW.getTime() - toMs(hoursToDone)).toISOString() : null,
  };
}
