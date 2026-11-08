import { describe, expect, it, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH, DELETE } from '../route';
import { InteriorScheduleAnalyticsService } from '@/products/bella-interior';

describe('API: /api/interior/schedule', () => {
  const TEST_TENANT = 'tenant-api-test-123';

  beforeEach(() => {
    InteriorScheduleAnalyticsService.resetTenantTasks(TEST_TENANT);
  });

  it('GET returns schedule overview with 200', async () => {
    const req = new NextRequest(`http://localhost:3000/api/interior/schedule?tenantId=${TEST_TENANT}`);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.kpis.totalTasks.value).toBe(48);
    expect(json.calendarEvents).toHaveLength(6);
  });

  it('POST creates a new task and returns 201 with updated overview', async () => {
    const payload = {
      tenantId: TEST_TENANT,
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
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.task.title).toBe('Thi công vách thạch cao');
    expect(json.data.task.projectName).toBe('The Garden Villa');
    expect(json.data.task.categoryLabel).toBe('Lắp đặt');
    expect(json.data.overview.kpis.totalTasks.value).toBe(49);
    expect(json.data.overview.calendarEvents).toHaveLength(7);
  });

  it('POST returns 422 if title is missing', async () => {
    const payload = {
      tenantId: TEST_TENANT,
      title: '',
    };

    const req = new NextRequest('http://localhost:3000/api/interior/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('VALIDATION_FAILED');
  });

  it('PATCH completes a task and returns 200', async () => {
    // First create a task
    const task = InteriorScheduleAnalyticsService.createScheduledTask(TEST_TENANT, {
      title: 'Nhiệm vụ kiểm thử',
      projectName: 'Office Tower',
      assignee: 'PM. Hùng',
      category: 'handover',
      dayIndex: 1,
      timeSlotId: 'slot-2',
    });

    const req = new NextRequest('http://localhost:3000/api/interior/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: TEST_TENANT, taskId: task.id }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.overview.kpis.completedTasks.value).toBe(33);
  });

  it('DELETE removes a task and returns 200', async () => {
    const task = InteriorScheduleAnalyticsService.createScheduledTask(TEST_TENANT, {
      title: 'Tạm hủy',
      projectName: 'Villa Sunrise',
      assignee: 'KTS. Lê Hoàng',
      category: 'design',
      dayIndex: 0,
      timeSlotId: 'slot-1',
    });

    const req = new NextRequest(
      `http://localhost:3000/api/interior/schedule?tenantId=${TEST_TENANT}&taskId=${task.id}`,
      { method: 'DELETE' },
    );

    const res = await DELETE(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.overview.calendarEvents).toHaveLength(6);
    expect(json.data.overview.kpis.totalTasks.value).toBe(48);
  });
});
