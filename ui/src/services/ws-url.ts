const DEFAULT_WS_URL = "ws://localhost:3001";

function getTokenFromLocation(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("token");
}

export function buildWsUrl(baseUrl: string = DEFAULT_WS_URL): string {
  const token = getTokenFromLocation();
  if (!token) {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl);
    if (!url.searchParams.has("token")) {
      url.searchParams.set("token", token);
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}
