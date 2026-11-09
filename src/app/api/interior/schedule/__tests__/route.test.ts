import { describe, expect, it } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH, DELETE } from '../route';

describe('API: /api/interior/schedule fail-closed boundary', () => {
  it('GET does not return demo schedules when canonical auth or persistence is unavailable', async () => {
    const req = new NextRequest('http://localhost:3000/api/interior/schedule');
    const res = await GET(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json).not.toHaveProperty('calendarEvents');
  });

  it('POST does not claim a schedule task was persisted', async () => {
    const payload = {
      title: 'Thi công vách thạch cao',
      projectName: 'The Garden Villa',
      assignee: 'Đội 3',
      category: 'site',
      dayIndex: 4,
      timeSlotId: 'slot-3',
      priority: 'urgent',
      notes: 'Yêu cầu kiểm tra mặt bằng trước khi lắp',
    };

    const req = new NextRequest('http://localhost:3000/api/interior/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('POST rejects before processing when canonical auth is unavailable', async () => {
    const payload = {
      title: '',
    };

    const req = new NextRequest('http://localhost:3000/api/interior/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('PATCH does not claim a schedule task was persisted', async () => {
    const req = new NextRequest('http://localhost:3000/api/interior/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: 'task-1' }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('DELETE does not claim a schedule task was removed', async () => {
    const req = new NextRequest('http://localhost:3000/api/interior/schedule?taskId=task-1', { method: 'DELETE' });

    const res = await DELETE(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
