import { STATUS_CODES } from 'node:http';
import { OpenAPIRegistry, OpenApiGeneratorV3, type RouteConfig } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { validate } from './http.js';

// The zod schemas are the API contract (ARCH §8). OpenAPI 3.0 for `openapi-generator -g dart-dio` (ARCH §14).
export const registry = new OpenAPIRegistry();
registry.registerComponent('securitySchemes', 'cookieAuth', { type: 'apiKey', in: 'cookie', name: 'dc_session' });
registry.registerComponent('securitySchemes', 'bearerAuth', { type: 'http', scheme: 'bearer' });

/** ARCH §8 error body; `route` adds it for the 401/422 every guarded/validated route can return. */
const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) }).meta({ id: 'Error' });

type Guard = 'public' | 'auth' | 'classAccess' | 'teach' | 'commons' | 'admin';

type Route = {
  method: RouteConfig['method'];
  /** Full path under /api/v1, Express style: `/classes/:id/posts`. */
  path: string;
  summary: string;
  guard: Guard;
  request?: { body?: z.ZodType; query?: z.ZodObject; params?: z.ZodObject };
  /** Status → JSON body schema; `null` = no body (204). */
  responses: Record<number, z.ZodType | null>;
};

/** Register the docs for a route and return its validator, so docs can't drift from the code. */
export const route = (reg: OpenAPIRegistry, { method, path, summary, guard, request = {}, responses }: Route) => {
  const errors = {
    ...(guard !== 'public' && { 401: errorBody }),
    ...(Object.keys(request).length > 0 && { 422: errorBody }),
  };
  reg.registerPath({
    method,
    path: path.replace(/:(\w+)/g, '{$1}'),
    summary,
    security: guard === 'public' ? [] : [{ cookieAuth: [] }, { bearerAuth: [] }],
    request: {
      ...(request.body && { body: { content: { 'application/json': { schema: request.body } } } }),
      ...(request.query && { query: request.query }),
      ...(request.params && { params: request.params }),
    },
    responses: Object.fromEntries(
      Object.entries({ ...errors, ...responses }).map(([status, schema]) => [
        status,
        { description: STATUS_CODES[status] ?? status, ...(schema && { content: { 'application/json': { schema } } }) },
      ]),
    ),
  });
  return validate(request);
};

export const openApiDocument = () =>
  new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: { title: 'Digital Campus API', version: '1.0.0' },
    servers: [{ url: '/api/v1' }],
  });

// /health is defined in app.ts, so its doc lives here.
route(registry, {
  method: 'get',
  path: '/health',
  summary: 'Health check',
  guard: 'public',
  responses: { 200: z.object({ ok: z.boolean() }) },
});

