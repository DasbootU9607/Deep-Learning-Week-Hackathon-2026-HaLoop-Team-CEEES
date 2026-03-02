export async function apiRequest<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await safeReadBody(response);
    throw new Error(`${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function safeReadBody(response: Response): Promise<string> {
  return response
    .text()
    .then((text) => text.trim())
    .catch(() => "");
}
