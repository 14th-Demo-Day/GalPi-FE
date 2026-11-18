import type {
  Attachment,
  Book,
  BookInput,
  BookPage,
  BookPages,
  PageType,
  Sort,
} from "./types";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code = "NETWORK_ERROR", status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export interface ApiOptions {
  baseUrl: string;
  getAccessToken: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void;
}

// The login owner supplies the token getter; no storage key or login route is assumed.
export function createActivityApi(options: ApiOptions) {
  async function response(path: string, init: RequestInit = {}) {
    if (!options.baseUrl)
      throw new ApiError("서버 연결을 확인해 주세요.", "API_NOT_CONFIGURED");
    const token = await options.getAccessToken();
    if (!token) {
      options.onUnauthorized?.();
      throw new ApiError("로그인이 필요해요.", "UNAUTHORIZED", 401);
    }
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    let res: Response;
    try {
      res = await fetch(`${options.baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        throw error;
      throw new ApiError("연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    if (res.status === 401) options.onUnauthorized?.();
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(
        body?.message || "요청을 처리하지 못했어요.",
        body?.code || "REQUEST_FAILED",
        res.status,
      );
    }
    return res;
  }
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await response(path, init);
    if (res.status === 204) return undefined as T;
    const body = await res.json();
    if (body.success === false)
      throw new ApiError(body.message, body.code, res.status);
    return body.data as T;
  }
  const json = (method: string, body?: unknown): RequestInit => ({
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function download(path: string, filename: string) {
    const res = await response(path);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return {
    request,
    download,
    books: (sort: Sort, signal?: AbortSignal) =>
      request<Book[]>(`/api/books?sort=${sort}`, { signal }),
    book: (id: number, signal?: AbortSignal) =>
      request<Book>(`/api/books/${id}`, { signal }),
    createBook: (input: BookInput & { firstPageType: PageType }) =>
      request<{ bookId: number; firstPageId: number }>(
        "/api/books",
        json("POST", input),
      ),
    updateBook: (id: number, input: BookInput) =>
      request<Book>(`/api/books/${id}`, json("PATCH", input)),
    deleteBook: (id: number) =>
      request<unknown>(`/api/books/${id}`, json("DELETE")),
    pages: (id: number, signal?: AbortSignal) =>
      request<BookPages>(`/api/books/${id}/pages`, { signal }),
    page: (id: number, signal?: AbortSignal) =>
      request<BookPage>(`/api/pages/${id}`, { signal }),
    createPage: (id: number, pageType: PageType) =>
      request<{ pageId: number; pageNo: number }>(
        `/api/books/${id}/pages`,
        json("POST", { pageType }),
      ),
    savePage: (id: number, content: Record<string, string>) =>
      request<BookPage>(`/api/pages/${id}`, json("PATCH", { content })),
    deletePage: (id: number) =>
      request<{ bookId: number; bookDeleted: boolean }>(
        `/api/pages/${id}`,
        json("DELETE"),
      ),
    upload: (id: number, file: File) => {
      const body = new FormData();
      body.append("file", file);
      return request<Attachment>(`/api/pages/${id}/attachments`, {
        method: "POST",
        body,
      });
    },
    deleteAttachment: (id: number) =>
      request<unknown>(`/api/attachments/${id}`, json("DELETE")),
    downloadAttachment: (file: Attachment) =>
      download(
        `/api/attachments/${file.attachmentId}/download`,
        file.originalName,
      ),
  };
}
export type ActivityApi = ReturnType<typeof createActivityApi>;
