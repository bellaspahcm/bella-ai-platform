import { NextResponse } from 'next/server';

function assignmentUnavailable() {
  return NextResponse.json({
    success: false,
    code: 'TEACHER_ASSIGNMENT_NOT_READY',
    error: 'Phân công và chấm dứt phân công giáo viên hiện chưa khả dụng.',
  }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
}

// Preserve the route signature; hold every caller before input or dependency access.
export async function POST(
  _request: Request,
  _context: { params: Promise<{ id: string }> }
) {
  return assignmentUnavailable();
}

export async function DELETE(
  _request: Request,
  _context: { params: Promise<{ id: string }> }
) {
  return assignmentUnavailable();
}
