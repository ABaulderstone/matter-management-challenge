import { describe, it, expect } from 'vitest';

import request from 'supertest';
import app from '../../src/app';
import { MattersResponseSchema } from './schemas';

describe('GET /api/v1/matters', () => {
  it('returns a valid matters response', async () => {
    const res = await request(app).get('/api/v1/matters').query({ limit: 20 }).expect(200);

    const parseResult = MattersResponseSchema.safeParse(res.body);

    if (!parseResult.success) {
      console.error(JSON.stringify(parseResult.error.format(), null, 2));
    }

    expect(parseResult.success).toBe(true);
    expect(parseResult.data?.total).toBe(16);
  });

  it('returns matters matching an exact subject search', async () => {
    const res = await request(app)
      .get('/api/v1/matters')
      .query({ search: 'Compliance' })
      .expect(200);

    const parseResult = MattersResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    const { data: result } = parseResult;
    expect(result?.total).toBe(4);
    result?.data.forEach((matter) => {
      expect(matter.fields.subject.value).toContain('Compliance');
    });
  });

  it('returns matters matching a fuzzy subject search', async () => {
    const res = await request(app)
      .get('/api/v1/matters')
      .query({ search: 'Complince' })
      .expect(200);

    const parseResult = MattersResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    const { data: result } = parseResult;
    expect(result?.total).toBe(4);
    result?.data.forEach((matter) => {
      expect(matter.fields.subject.value).toContain('Compliance');
    });
  });

  it('returns matters matching an exact user search', async () => {
    const res = await request(app)
      .get('/api/v1/matters')
      .query({ search: 'BJ Blazkowicz' })
      .expect(200);

    const parseResult = MattersResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    const { data: result } = parseResult;
    expect(result?.total).toBe(4);
    result?.data.forEach((matter) => {
      expect(matter.fields['Assigned To'].displayValue).toBe('BJ Blazkowicz');
    });
  });

  it('returns matters matching a fuzzy user search', async () => {
    const res = await request(app)
      .get('/api/v1/matters')
      .query({ search: 'Blakowicz' })
      .expect(200);

    const parseResult = MattersResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    const { data: result } = parseResult;
    expect(result?.total).toBe(4);
    result?.data.forEach((matter) => {
      expect(matter.fields['Assigned To'].displayValue).toBe('BJ Blazkowicz');
    });
  });

  it('returns matters matching a case number search', async () => {
    const res = await request(app).get('/api/v1/matters').query({ search: '202500' }).expect(200);

    const parseResult = MattersResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    const { data: result } = parseResult;
    expect(result?.total).toBe(1);
    result?.data.forEach((matter) => {
      expect(matter.fields['Case Number'].value).toBe(202500);
    });
  });

  it('returns matters matching a sla search', async () => {
    const res = await request(app).get('/api/v1/matters').query({ search: 'Breached' }).expect(200);

    const parseResult = MattersResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    const { data: result } = parseResult;
    expect(result?.total).toBe(4);
    result?.data.forEach((matter) => {
      expect(matter.sla).toBe('Breached');
    });
  });

  it('sorts matters by SLA', async () => {
    const res = await request(app)
      .get('/api/v1/matters')
      .query({ sortBy: 'sla', sortOrder: 'desc' })
      .expect(200);

    const parseResult = MattersResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    const { data: result } = parseResult;
    expect(result?.total).toBe(16);
    const breachedSlice = result?.data.slice(0, 4);
    breachedSlice?.forEach((matter) => expect(matter.sla).toBe('Breached'));
    const metSlice = result?.data.slice(4, 8);
    metSlice?.forEach((matter) => expect(matter.sla).toBe('Met'));
    const inProgressSlice = result?.data.slice(8);
    inProgressSlice?.forEach((matter) => expect(matter.sla).toBe('In Progress'));
  });

  it('sorts matters by priority', async () => {
    const res = await request(app)
      .get('/api/v1/matters')
      .query({ sortBy: 'Priority', sortOrder: 'asc' })
      .expect(200);

    const parseResult = MattersResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    const { data: result } = parseResult;
    expect(result?.total).toBe(16);

    const priorities = result?.data.map((matter) => matter.fields.Priority.displayValue);

    const lowSlice = priorities?.slice(0, 4);
    const mediumSlice = priorities?.slice(4, 8);
    const highSlice = priorities?.slice(8, 12);
    const criticalSlice = priorities?.slice(12);

    lowSlice?.forEach((p) => expect(p).toBe('Low'));
    mediumSlice?.forEach((p) => expect(p).toBe('Medium'));
    highSlice?.forEach((p) => expect(p).toBe('High'));
    criticalSlice?.forEach((p) => expect(p).toBe('Critical'));
  });
});
