import { NextResponse } from 'next/server';

// Medication administration is outside the active Preschool Product scope.
export async function POST(_request: Request) {
  return NextResponse.json({
    success: false,
    error: 'PRESCHOOL_MEDICATION_DISABLED',
    message: 'Chức năng ghi nhận dùng thuốc đã được tắt và không thuộc phạm vi hoạt động của Bella Preschool.',
  }, {
    status: 410,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
