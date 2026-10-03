import type { paths } from './schema';
import { toast } from '../ui/Toast';

// Typed fetch over the generated schema (`npm run gen:api`), same call shape as openapi-fetch:
//   const { data, error } = await api.GET('/classes/{id}', { params: { path: { id } } });
// ponytail: hand-rolled because openapi-fetch isn't installed in web; swapping to
// `createClient<paths>({ baseUrl, credentials: 'include' })` + a middleware keeps every call site.

export type ApiError = { code: string; message: string };

const BASE = '/api/v1';

let memoryId: string | undefined;
export function deviceId(): string {
  try {
    let id = localStorage.getItem('deviceId');
    if (!id) localStorage.setItem('deviceId', (id = crypto.randomUUID()));
    return id;
  } catch {
    // Private mode / storage blocked: stable for this page load only.
    return (memoryId ??= crypto.randomUUID());
  }
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type PathsWith<M extends Method> = { [P in keyof paths]: paths[P][M] extends { responses: unknown } ? P : never }[keyof paths];
type Op<P extends keyof paths, M extends Method> = Exclude<paths[P][M], undefined>;
// Drop `k?: never` keys; keep the generated required/optional modifiers.
type Strip<T> = { [K in keyof T as [Exclude<T[K], undefined>] extends [never] ? never : K]: T[K] };
type Json<T> = T extends { content: { 'application/json': infer J } } ? J : undefined;
type Params<O> = O extends { parameters: infer P }
  ? keyof Strip<P> extends never ? {} : {} extends Strip<P> ? { params?: Strip<P> } : { params: Strip<P> }
  : {};
type Body<O> = O extends { requestBody: infer B }
  ? { body: Json<B> }
  : O extends { requestBody?: infer B } ? ([Exclude<B, undefined>] extends [never] ? {} : { body?: Json<Exclude<B, undefined>> }) : {};
type Init<O> = Params<O> & Body<O>;
type Data<O> = O extends { responses: infer R } ? Json<R[Extract<keyof R, 200 | 201 | 204>]> : never;
export type Result<T> = { data: T; error?: undefined; response: Response } | { data?: undefined; error: ApiError; response?: Response };

type RawInit = { params?: { path?: Record<string, unknown>; query?: Record<string, unknown> }; body?: unknown };

async function request(method: Method, path: string, init: RawInit = {}): Promise<Result<unknown>> {
  const { params, body } = init;
  let url = BASE + path.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(String(params?.path?.[k])));
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params?.query ?? {})) if (v != null) q.set(k, String(v));
  if (q.size) url += `?${q}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: method.toUpperCase(),
      credentials: 'include',
      headers: { 'X-Device-Id': deviceId(), ...(body !== undefined && { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { error: { code: 'NETWORK', message: "Can't reach the server. Check your connection." } };
  }
  const json = await response.json().catch(() => undefined);
  if (response.ok) return { data: json, response };

  const error: ApiError = json?.error ?? { code: `HTTP_${response.status}`, message: 'Something went wrong. Try again.' };
  // /auth/* handles its own 401s (bad password, the route guard's /auth/me).
  if (response.status === 401 && !path.startsWith('/auth/')) location.assign('/login');
  if (response.status === 403) toast(error.message);
  return { error, response };
}

const call =
  <M extends Method>(m: M) =>
  <P extends PathsWith<M>>(path: P, ...[init]: {} extends Init<Op<P, M>> ? [Init<Op<P, M>>?] : [Init<Op<P, M>>]) =>
    request(m, path, init as RawInit) as Promise<Result<Data<Op<P, M>>>>;

export const api = { GET: call('get'), POST: call('post'), PUT: call('put'), PATCH: call('patch'), DELETE: call('delete') };

// For react-query: throw the {code, message} so `error` lands on the query/mutation.
export async function unwrap<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (r.error) throw r.error;
  return r.data as T;
}
