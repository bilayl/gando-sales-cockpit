export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === "string"
      ? body.error
      : typeof body?.message === "string"
        ? body.message
        : `Erreur HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}
