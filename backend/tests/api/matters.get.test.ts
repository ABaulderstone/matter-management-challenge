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
});
