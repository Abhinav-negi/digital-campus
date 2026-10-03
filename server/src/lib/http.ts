import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z } from 'zod';

/** Throw anywhere in a handler; the error handler turns it into `{ error: { code, message } }`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };

/** Parse body/query/params with zod and replace them with the parsed values; failures → 422 VALIDATION. */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) throw new HttpError(422, 'VALIDATION', z.prettifyError(result.error));
      // Express 5 makes req.query a getter, so redefine instead of assigning.
      Object.defineProperty(req, key, { value: result.data, writable: true, enumerable: true });
    }
    next();
  };

export const notImplemented: RequestHandler = (req) => {
  throw new HttpError(501, 'NOT_IMPLEMENTED', `${req.method} ${req.originalUrl} is not implemented yet`);
};

export const notFound: RequestHandler = (req) => {
  throw new HttpError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // body-parser and friends set `status` (400 bad JSON, 413 too large).
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: status === 500 ? { code: 'INTERNAL', message: 'Something went wrong' } : { code: 'BAD_REQUEST', message: err.message },
  });
};

/** `?cursor=&limit=` for list endpoints. */
export const pageQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Prisma args for one page: fetch one extra row to know whether there's a next page. */
export const paginate = (cursor: string | undefined, limit: number) => ({
  take: limit + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
});

/** Rows fetched with `paginate` → `{ items, nextCursor }`. */
export const page = <T extends { id: string }>(rows: T[], limit: number) => ({
  items: rows.slice(0, limit),
  nextCursor: rows.length > limit ? (rows[limit - 1]?.id ?? null) : null,
});
