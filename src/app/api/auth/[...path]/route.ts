import { auth } from '@/infrastructure/auth/server';

export const { GET, POST } = auth.handler();
