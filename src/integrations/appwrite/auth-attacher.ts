import { createMiddleware } from '@tanstack/react-start';
import { getSessionToken } from './client';

// Registers globally as functionMiddleware in src/start.ts
// so that the browser attaches the bearer JWT to serverFn RPCs.
export const attachAppwriteAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const token = await getSessionToken();
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
