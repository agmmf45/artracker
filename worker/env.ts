export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  FILES?: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  AI_MODEL?: string;
  /** model for the app-wide assistant (default claude-opus-5-5) */
  ASSISTANT_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  EXERCISEDB_KEY?: string;
  /** local dev only (.dev.vars): multiplies every rate limit */
  RATE_LIMIT_SCALE?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  sessionKey: string;
  sessionCreatedAt: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } };
