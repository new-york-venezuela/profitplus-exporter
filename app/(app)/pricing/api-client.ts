export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'ApiError'; }
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data && typeof data.error === 'string') ? data.error : res.status > 0 ? `Error del servidor (${res.status})` : 'Error de red', res.status);
  return data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  try { return await parse<T>(await fetch(url)); }
  catch (e) { throw e instanceof ApiError ? e : new ApiError('Error de red', 0); }
}

export async function apiSend<T>(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  try {
    return await parse<T>(await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  } catch (e) { throw e instanceof ApiError ? e : new ApiError('Error de red', 0); }
}
