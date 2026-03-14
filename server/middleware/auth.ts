// Stack Auth JWT verification middleware
// Reference: https://stack-auth.com/docs/concepts/backend-integration
// Reference: https://stack-auth.com/docs/concepts/jwt
// Uses local JWT verification via jose for ~0ms auth checks (no network round-trip)

import * as jose from 'jose';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { AuthenticatedRequest } from '../types.js';

// Cache JWKS -- jose library automatically refreshes on key rotation (kid mismatch)
let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(
      new URL(`https://api.stack-auth.com/api/v1/projects/${config.stackProjectId}/.well-known/jwks.json`)
    );
  }
  return jwks;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const accessToken = req.headers['x-stack-access-token'] as string | undefined;

  if (!accessToken) {
    // In development, allow unauthenticated requests
    if (config.nodeEnv !== 'production') {
      (req as AuthenticatedRequest).userId = 'dev-user';
      next();
      return;
    }
    res.status(401).json({ error: 'Missing access token. Send x-stack-access-token header.' });
    return;
  }

  if (!config.stackProjectId) {
    res.status(500).json({ error: 'Server misconfigured: STACK_PROJECT_ID not set.' });
    return;
  }

  try {
    const { payload } = await jose.jwtVerify(accessToken, getJWKS(), {
      audience: config.stackProjectId,
    });

    // Reject anonymous users
    if (payload.is_anonymous) {
      res.status(403).json({ error: 'Anonymous users cannot access this endpoint.' });
      return;
    }

    // Reject restricted users (unverified email, admin-restricted, etc.)
    if (payload.is_restricted) {
      res.status(403).json({ error: 'Restricted users cannot access this endpoint.' });
      return;
    }

    // Attach user info to request for downstream handlers
    (req as AuthenticatedRequest).userId = payload.sub as string;
    (req as AuthenticatedRequest).userEmail = (payload.email as string) || undefined;
    (req as AuthenticatedRequest).userName = (payload.name as string) || undefined;

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('JWT verification failed:', message);
    res.status(401).json({ error: 'Invalid or expired access token.' });
    return;
  }
}
