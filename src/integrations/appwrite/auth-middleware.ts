import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createUserClient, createAdminClient } from './client.server';

export const requireAppwriteAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header provided');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Only Bearer tokens are supported');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('Unauthorized: No token provided');
    }

    try {
      // Create user client using the JWT token
      const userClient = createUserClient(token);

      // Validate the token by getting the user's account details.
      // This will throw if the token is invalid or expired.
      const user = await userClient.account.get();
      const userId = user.$id;

      // Create admin client for operations requiring system/admin privilege (bypassing user RLS)
      const adminClient = createAdminClient();

      return next({
        context: {
          appwrite: userClient,
          appwriteAdmin: adminClient,
          databases: adminClient.databases,
          userId,
          user,
        },
      });
    } catch (error) {
      console.error('[requireAppwriteAuth] Auth verification failed:', error);
      throw new Error('Unauthorized: Invalid or expired token');
    }
  },
);
