const BASE = "/api";
export const getToken = () => localStorage.getItem("token");
export const setToken = (t: string | null) => (t ? localStorage.setItem("token", t) : localStorage.removeItem("token"));

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function parse(res: Response) {
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("json") ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      window.dispatchEvent(new Event("auth:logout"));
    }
    let msg = res.statusText;
    if (typeof body === "object" && body) {
      const d = (body as any).detail;
      msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((e: any) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join("; ") : msg;
    }
    throw new ApiError(res.status, msg);
  }
  return body;
}

const headers = (extra: Record<string, string> = {}) => {
  const t = getToken();
  return { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra };
};

export const api = {
  get: <T = any>(path: string, params?: Record<string, any>): Promise<T> => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString() : "";
    return fetch(BASE + path + qs, { headers: headers() }).then(parse);
  },
  send: <T = any>(method: string, path: string, body?: unknown): Promise<T> =>
    fetch(BASE + path, { method, headers: headers({ "Content-Type": "application/json" }), body: body === undefined ? undefined : JSON.stringify(body) }).then(parse),
  post: <T = any>(path: string, body?: unknown) => api.send<T>("POST", path, body),
  put: <T = any>(path: string, body?: unknown) => api.send<T>("PUT", path, body),
  del: (path: string) => api.send("DELETE", path),
  upload: <T = any>(path: string, form: FormData): Promise<T> => fetch(BASE + path, { method: "POST", headers: headers(), body: form }).then(parse),
  /** Descarga un archivo autenticado */
  download: async (path: string, filename: string) => {
    const res = await fetch(BASE + path, { headers: headers() });
    if (!res.ok) throw new ApiError(res.status, "No se pudo descargar");
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
