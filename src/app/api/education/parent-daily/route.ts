import { NextResponse } from 'next/server';

// Temporary containment until trusted guardian binding and read scope are implemented and verified.
export async function GET() {
  console.warn('[education/parent-daily] PARENT_ACCESS_NOT_READY');
  return NextResponse.json({
    success: false,
    error: 'PARENT_ACCESS_NOT_READY',
    message: 'Quyền truy cập hồ sơ phụ huynh đang được xác minh. Vui lòng liên hệ nhà trường.',
  }, { status: 503 });
}
