import type { ActivityApi } from "../activity/api";
import { ApiError } from "../activity/api.ts";
import { SAVED_PAGE_SIZE, toEvidence, toSavedPage } from "./connection.ts";
import type {
  SavedConnection,
  ConnectionDetail,
  ConnectionResult,
  CreatedConnection,
  EligibleBook,
  EligibleBooks,
  SavedListResponse,
  SavedPage,
} from "./connection";

// "RECORD": the records or the AI could not produce a sentence (Figma 02 예외).
// "SERVER": the request itself failed (Figma 03 예외).
export class ConnectionError extends Error {
  readonly kind: "RECORD" | "SERVER";
  readonly code: string;
  constructor(
    kind: "RECORD" | "SERVER",
    message = "문장을 만들지 못했어요.",
    code = "",
  ) {
    super(message);
    this.kind = kind;
    this.code = code;
  }
}

const RECORD_CODES = ["BOOK_NOT_ELIGIBLE", "INSUFFICIENT_EVIDENCE", "AI_GENERATION_FAILED"];
// After these, the eligible list on the selection screen is out of date.
export const STALE_SELECTION_CODES = ["INVALID_BOOK_COUNT", "BOOK_NOT_FOUND", "BOOK_NOT_ELIGIBLE"];

export function toConnectionError(e: unknown) {
  if (e instanceof DOMException && e.name === "AbortError") return e;
  if (e instanceof ApiError)
    return new ConnectionError(
      RECORD_CODES.includes(e.code) ? "RECORD" : "SERVER",
      e.message,
      e.code,
    );
  return new ConnectionError("SERVER");
}

export interface ConnectionApi {
  // hasBooks tells "no books at all" (first-record screen) from "not enough
  // ready books" (shortage screen); the endpoint itself only lists ready ones.
  books: (signal?: AbortSignal) => Promise<{
    data: EligibleBooks;
    hasBooks: boolean;
  }>;
  generate: (
    books: EligibleBook[],
    signal?: AbortSignal,
  ) => Promise<ConnectionResult>;
  result: (
    connectionId: number,
    signal?: AbortSignal,
  ) => Promise<ConnectionResult>;
  saved: (page?: number, signal?: AbortSignal) => Promise<SavedPage>;
  save: (connectionId: number, sentence: string) => Promise<SavedConnection>;
}

// books: GET /api/connections/eligible-books (3.1.1).
// generate: POST /api/connections (3.2.2).
// result: GET /api/connections/{connectionId} (3.2.3).
// save: POST /api/connections/{connectionId}/save (3.3.1).
// saved: GET /api/connections/saved (3.3.2).
export function createLocalConnectionApi(api: ActivityApi): ConnectionApi {
  return {
    async books(signal) {
      const data = await api.request<EligibleBooks>(
        "/api/connections/eligible-books",
        { signal },
      );
      const hasBooks =
        data.eligibleCount > 0 ||
        (await api.books("LATEST", signal)).length > 0;
      return { data, hasBooks };
    },
    async generate(books, signal) {
      let created: CreatedConnection;
      try {
        created = await api.request<CreatedConnection>("/api/connections", {
          method: "POST",
          body: JSON.stringify({ bookIds: books.map((b) => b.bookId) }),
          signal,
        });
      } catch (e) {
        throw toConnectionError(e);
      }
      return {
        connectionId: created.connectionId,
        sentence: created.suggestedSentence,
        evidence: created.evidences.map(toEvidence),
      };
    },
    async result(connectionId, signal) {
      const d = await api.request<ConnectionDetail>(
        `/api/connections/${connectionId}`,
        { signal },
      );
      return {
        connectionId: d.connectionId,
        saved: d.saved,
        sentence: d.finalSentence ?? d.suggestedSentence,
        evidence: d.evidences.map(toEvidence),
      };
    },
    async saved(page = 0, signal) {
      const r = await api.request<SavedListResponse>(
        `/api/connections/saved?page=${page}&size=${SAVED_PAGE_SIZE}`,
        { signal },
      );
      return toSavedPage(r);
    },
    async save(connectionId, sentence) {
      return api.request<SavedConnection>(
        `/api/connections/${connectionId}/save`,
        {
          method: "POST",
          body: JSON.stringify({ finalSentence: sentence.trim() }),
        },
      );
    },
  };
}

const cache = new WeakMap<ActivityApi, ConnectionApi>();
export function connectionApiFor(api: ActivityApi) {
  let value = cache.get(api);
  if (!value) cache.set(api, (value = createLocalConnectionApi(api)));
  return value;
}
