export class TappyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TappyError";
  }
}

export type FetchLike = typeof fetch;

export type HttpResult = {
  status: number;
  url: string;
  html: string;
};

const MAX_REDIRECTS = 10;

export function normalizeBaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new TappyError(`ベース URL が不正です: ${baseUrl}`);
  }
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), base).href;
}

export class TappyHttp {
  readonly baseUrl: string;
  private readonly cookies = new Map<string, string>();
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl: string, fetchImpl: FetchLike = fetch) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.fetchImpl = fetchImpl;
  }

  get(path: string): Promise<HttpResult> {
    return this.request("GET", path);
  }

  post(path: string, body: URLSearchParams): Promise<HttpResult> {
    return this.request("POST", path, body);
  }

  private async request(
    method: string,
    path: string,
    body?: URLSearchParams,
  ): Promise<HttpResult> {
    let url = joinUrl(this.baseUrl, path);
    let currentMethod = method;
    let currentBody = body;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const headers: Record<string, string> = {
        "user-agent": "tappy-cli",
        accept: "text/html",
      };
      const cookie = this.cookieHeader();
      if (cookie) headers.cookie = cookie;
      if (currentBody) {
        headers["content-type"] = "application/x-www-form-urlencoded";
      }

      const response = await this.fetchImpl(url, {
        method: currentMethod,
        headers,
        body: currentBody?.toString(),
        redirect: "manual",
      });
      this.storeCookies(response.headers);

      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) {
          throw new TappyError(`リダイレクト先がありません (${response.status})`);
        }
        url = new URL(location, url).href;
        if (response.status === 301 || response.status === 302 || response.status === 303) {
          currentMethod = "GET";
          currentBody = undefined;
        }
        continue;
      }

      const html = await response.text();
      return { status: response.status, url, html };
    }

    throw new TappyError("リダイレクトが多すぎます");
  }

  private storeCookies(headers: Headers): void {
    const setCookies =
      typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const pair = raw.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name) this.cookies.set(name, value);
    }
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
