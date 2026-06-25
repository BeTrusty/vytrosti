import { auth } from '@/infrastructure/auth/server';
import { NextRequest } from 'next/server';

const authMiddleware = auth.middleware({
  loginUrl: '/login',
});

export default function proxy(request: NextRequest) {
  return authMiddleware(request);
}

export const config = {
  matcher: ['/admin/:path*', '/reservations/:path*'],
};
