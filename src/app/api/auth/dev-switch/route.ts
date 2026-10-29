import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email') || 'admin.preschool@bellaspa.vn';
  const redirectPath = request.nextUrl.searchParams.get('redirect') || '/dashboard/education';
  
  const targetUrl = new URL(redirectPath, request.url);
  const response = NextResponse.redirect(targetUrl);
  
  if (process.env.NODE_ENV === 'development') {
    response.cookies.set('mock_user_email', email, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
  }
  
  return response;
}
