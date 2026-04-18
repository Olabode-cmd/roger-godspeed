/**
 * plugins.test.ts
 *
 * Unit tests validating the Godspeed built-in opt-in middleware plugins:
 * Auth, Logger, and Schema Validator.
 *
 * Dependencies: imports plugins from `src/middleware`.
 */
import { describe, test, expect } from 'bun:test';
import { bearerAuth, logger, validateResponse } from '../../src/middleware';
import { ValidationError } from '../../src/errors';
import type { GodspeedResponse, NextFn } from '../../src/types';

describe('Built-in Plugins', () => {
  const dummyRequest = new Request('https://test.com');
  const dummyResponse: GodspeedResponse<unknown> = {
    status: 200, statusText: 'OK', headers: new Headers(), parsedBody: { data: 'ok' }
  };
  const mockNext: NextFn = async (_req: Request) => dummyResponse;

  describe('Auth Middleware', () => {
    test('Injects static token', async () => {
      let forwardedToken = '';
      const captureNext: NextFn = async (req: Request) => {
        forwardedToken = req.headers.get('Authorization') ?? '';
        return dummyResponse;
      };

      const mw = bearerAuth('test-token');
      await mw(dummyRequest, captureNext);

      expect(forwardedToken).toBe('Bearer test-token');
    });

    test('Invokes dynamic async token provider', async () => {
      let forwardedToken = '';
      const captureNext: NextFn = async (req: Request) => {
        forwardedToken = req.headers.get('Authorization') ?? '';
        return dummyResponse;
      };

      const mw = bearerAuth(async () => 'dynamic-token');
      await mw(dummyRequest, captureNext);

      expect(forwardedToken).toBe('Bearer dynamic-token');
    });

    test('Creates a new Request instead of mutating the original', async () => {
      let forwardedReq: Request | null = null;
      const captureNext: NextFn = async (req: Request) => {
        forwardedReq = req;
        return dummyResponse;
      };

      const mw = bearerAuth('token');
      await mw(dummyRequest, captureNext);

      expect(forwardedReq).not.toBe(dummyRequest);
      expect(forwardedReq).toBeInstanceOf(Request);
    });
  });

  describe('Logger Middleware', () => {
    test('Triggers onReq and onRes callbacks securely', async () => {
      let reqHit = false;
      let resHit = false;

      const mw = logger({
        onReq: (_req) => { reqHit = true; },
        onRes: (_res, _req) => { resHit = true; }
      });

      await mw(dummyRequest, mockNext);
      expect(reqHit).toBe(true);
      expect(resHit).toBe(true);
    });

    test('Triggers onError and successfully bubbles the throw', async () => {
      let errHit = false;
      const mw = logger({
        onError: (_err, _req) => { errHit = true; }
      });

      try {
        await mw(dummyRequest, async () => { throw new Error('bang'); });
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(errHit).toBe(true);
        if (err instanceof Error) {
          expect(err.message).toBe('bang');
        }
      }
    });

    test('Works with no options provided', async () => {
      const mw = logger();
      const res = await mw(dummyRequest, mockNext);
      expect(res.status).toBe(200);
    });
  });

  describe('Validator Middleware', () => {
    test('Utilizes .parse() standard correctly', async () => {
      const mockSchema = {
        parse: (d: unknown) => {
          const obj = d as Record<string, unknown>;
          return { ...obj, validated: true };
        }
      };
      const mw = validateResponse<Record<string, unknown>>(mockSchema);
      const res = await mw(dummyRequest, mockNext);

      expect(res.parsedBody).toEqual({ data: 'ok', validated: true });
    });

    test('Catches .parse() exceptions and packages into ValidationError', async () => {
      const failingSchema = {
        parse: (_d: unknown): never => { throw new Error('schema mismatch'); }
      };
      const mw = validateResponse<never>(failingSchema);

      try {
        await mw(dummyRequest, mockNext);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ValidationError);
        if (err instanceof ValidationError) {
          expect(err.details).toBeInstanceOf(Error);
          if (err.details instanceof Error) {
            expect(err.details.message).toBe('schema mismatch');
          }
        }
      }
    });

    test('Utilizes .safeParse() correctly without throwing', async () => {
      const mockSafe = {
        safeParse: (_d: unknown) => ({ success: true as const, data: 'safe-parsed' })
      };
      const mw = validateResponse<string>(mockSafe);
      const res = await mw(dummyRequest, mockNext);

      expect(res.parsedBody).toBe('safe-parsed');
    });

    test('Catches .safeParse() rejection and repacks into ValidationError', async () => {
      const failSafe = {
        safeParse: (_d: unknown) => ({ success: false as const, error: 'invalid payload map' })
      };
      const mw = validateResponse<string>(failSafe);

      try {
        await mw(dummyRequest, mockNext);
        expect(true).toBe(false);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ValidationError);
        if (err instanceof ValidationError) {
          expect(err.details).toBe('invalid payload map');
        }
      }
    });
  });
});
