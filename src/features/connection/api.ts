import type { ActivityApi } from "../activity/api";
import { evidenceFrom, isReadyPage } from "./connection.ts";
import type { Candidate, ConnectionResult, SavedSentence } from "./connection";
import { todayString } from "../roadmap/roadmap.ts";

// "RECORD": the records could not support a sentence (Figma 02 예외).
// "SERVER": the request itself failed (Figma 03 예외).
export class ConnectionError extends Error {
  readonly kind: "RECORD" | "SERVER";
  constructor(kind: "RECORD" | "SERVER", message = "문장을 만들지 못했어요.") {
    super(message);
    this.kind = kind;
  }
}

export interface ConnectionApi {
  books: (signal?: AbortSignal) => Promise<{
    total: number;
    candidates: Candidate[];
  }>;
  generate: (
    candidates: Candidate[],
    signal?: AbortSignal,
  ) => Promise<ConnectionResult>;
  saved: (signal?: AbortSignal) => Promise<SavedSentence[]>;
  save: (
    input: Pick<SavedSentence, "sentence" | "evidence" | "isFirst">,
  ) => Promise<SavedSentence>;
  update: (id: number, sentence: string) => Promise<SavedSentence>;
  clear: () => Promise<void>;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });

// No connection backend yet: readiness is read from the activity API, while
// sentence generation and saved sentences are a stand-in kept in memory.
// Replace generate/saved/save/update with server calls once the API exists.
// Dev only: add ?connect=fail-record or ?connect=fail-server to see the failure screens.
export function createLocalConnectionApi(api: ActivityApi): ConnectionApi {
  let saved: SavedSentence[] = [];
  let nextId = 1;
  const failMode = () =>
    import.meta.env?.DEV
      ? new URLSearchParams(location.search).get("connect")
      : null;
  return {
    async books(signal) {
      const books = await api.books("LATEST", signal);
      const candidates: Candidate[] = [];
      for (const book of books) {
        const { pages } = await api.pages(book.bookId, signal);
        for (const summary of pages) {
          if (summary.pageType !== "ACTIVITY") continue;
          const page = await api.page(summary.pageId, signal);
          if (isReadyPage(page)) {
            candidates.push({ book, evidence: evidenceFrom(page) });
            break;
          }
        }
      }
      return { total: books.length, candidates };
    },
    async generate(candidates, signal) {
      await wait(2400, signal);
      const mode = failMode();
      if (mode === "fail-record") throw new ConnectionError("RECORD");
      if (mode === "fail-server") throw new ConnectionError("SERVER");
      return {
        // Placeholder until the AI endpoint exists.
        sentence:
          "복잡한 정보를 정리해, 이해하기 쉬운 콘텐츠로 전달하는 경험을 쌓아왔습니다.",
        evidence: candidates.map((c) => c.evidence),
        isFirst: saved.length === 0,
      };
    },
    async saved() {
      return structuredClone(saved);
    },
    async save(input) {
      const item: SavedSentence = {
        id: nextId++,
        ...structuredClone(input),
        savedAt: todayString(),
      };
      saved = [item, ...saved];
      return structuredClone(item);
    },
    async update(id, sentence) {
      const item = saved.find((s) => s.id === id);
      if (!item) throw new ConnectionError("SERVER", "문장을 찾지 못했어요.");
      item.sentence = sentence;
      return structuredClone(item);
    },
    async clear() {
      saved = [];
    },
  };
}

const cache = new WeakMap<ActivityApi, ConnectionApi>();
export function connectionApiFor(api: ActivityApi) {
  let value = cache.get(api);
  if (!value) cache.set(api, (value = createLocalConnectionApi(api)));
  return value;
}
