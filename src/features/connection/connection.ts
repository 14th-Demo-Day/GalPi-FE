import { ApiError } from "../activity/api.ts";
import { pageTypes } from "../activity/types.ts";
import type { Book, BookPage, PageType } from "../activity/types";

export const MIN_FIELD_LENGTH = 20;
export const MIN_BOOKS = 2;
export const MAX_BOOKS = 3;
// T·A·R of one activity page must each be long enough to connect.
export const REQUIRED_FIELDS = ["task", "action", "result"] as const;

// One source record as shown on the result screen.
export interface Evidence {
  evidenceId?: number;
  // null once the source book or page has been deleted.
  bookId: number | null;
  bookTitle: string;
  pageId: number | null;
  label: string; // e.g. "활동 · 인터뷰 콘텐츠 제작"
  quote: string;
}

// POST /api/connections (3.2.2) request body and response (data).
export interface CreateConnectionInput {
  bookIds: number[];
}
export interface ServerEvidence {
  evidenceId: number;
  bookId: number | null;
  bookTitle: string;
  pageId: number | null;
  pageType: PageType;
  pageTitle: string;
  sectionKey: string;
  quote: string;
}
export interface CreatedConnection {
  connectionId: number;
  suggestedSentence: string;
  bookCount: number;
  evidences: ServerEvidence[];
}
// POST /api/connections/{connectionId}/save (3.3.1) response (data).
export interface SavedConnection {
  connectionId: number;
  finalSentence: string;
  savedAt: string;
}
export const MAX_SENTENCE_LENGTH = 300;

// GET /api/connections/{connectionId} (3.2.3) response (data).
export interface ConnectionDetail {
  connectionId: number;
  suggestedSentence: string;
  finalSentence: string | null;
  saved: boolean;
  savedAt: string | null;
  evidences: ServerEvidence[];
}

export const toEvidence = (e: ServerEvidence): Evidence => ({
  evidenceId: e.evidenceId,
  bookId: e.bookId,
  bookTitle: e.bookTitle,
  pageId: e.pageId,
  label: `${pageTypes[e.pageType]?.label ?? "활동"} · ${e.pageTitle}`,
  quote: e.quote,
});
// GET /api/connections/eligible-books response (data).
export interface EligibleBook {
  bookId: number;
  title: string;
  category: Book["category"];
  startDate: string;
  coverColor: string; // hex, e.g. "#2F5D4A"
}
export interface EligibleBooks {
  canConnect: boolean;
  eligibleCount: number;
  books: EligibleBook[];
}

const COVER_HEX: Record<NonNullable<Book["coverColor"]>, string> = {
  GREEN: "#2F5D4A",
  SAGE: "#E5EDE6",
  CREAM: "#EFE8D9",
};
// Light text on dark covers, ink on light ones.
export function isDarkColor(hex: string) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((v) => parseInt(v, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

// Dev preview counterpart of the endpoint: books with a ready activity page.
export function buildEligibleBooks(
  books: Book[],
  pages: Pick<BookPage, "bookId" | "pageType" | "content">[],
): EligibleBooks {
  const eligible = books
    .filter((b) => pages.some((p) => p.bookId === b.bookId && isReadyPage(p)))
    .map((b) => ({
      bookId: b.bookId,
      title: b.title,
      category: b.category,
      startDate: b.startDate.slice(0, 10),
      coverColor: COVER_HEX[b.coverColor ?? "CREAM"],
    }));
  return {
    canConnect: eligible.length >= MIN_BOOKS,
    eligibleCount: eligible.length,
    books: eligible,
  };
}
export interface ConnectionResult {
  connectionId: number;
  saved?: boolean;
  sentence: string;
  evidence: Evidence[];
}
// GET /api/connections/saved?page=&size= (3.3.2), newest first.
export interface SavedListResponse {
  totalCount: number;
  page: number;
  size: number;
  hasNext: boolean;
  items: {
    connectionId: number;
    finalSentence: string;
    savedAt: string;
    bookTitles: string[];
  }[];
}
export interface SavedSentence {
  id: number; // connectionId
  sentence: string;
  savedAt: string; // YYYY-MM-DD
  bookTitles: string[];
}
export interface SavedPage {
  totalCount: number;
  page: number;
  hasNext: boolean;
  items: SavedSentence[];
}
export const SAVED_PAGE_SIZE = 20;

export const toSavedPage = (r: SavedListResponse): SavedPage => ({
  totalCount: r.totalCount,
  page: r.page,
  hasNext: r.hasNext,
  items: r.items.map((i) => ({
    id: i.connectionId,
    sentence: i.finalSentence,
    savedAt: i.savedAt.slice(0, 10),
    bookTitles: i.bookTitles,
  })),
});

export const isReadyPage = (page: Pick<BookPage, "pageType" | "content">) =>
  page.pageType === "ACTIVITY" &&
  REQUIRED_FIELDS.every(
    (key) => (page.content[key] ?? "").trim().length >= MIN_FIELD_LENGTH,
  );

const firstSentence = (text: string) =>
  text
    .trim()
    .split(/\n|(?<=[.!?。])\s/)[0]
    .trim();
const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

export function evidenceFrom(
  page: BookPage,
  evidenceId = 0,
): ServerEvidence {
  const task = firstSentence(page.content.task ?? "").split(/[,.]/)[0];
  return {
    evidenceId,
    bookId: page.bookId,
    bookTitle: page.bookTitle,
    pageId: page.pageId,
    pageType: page.pageType,
    pageTitle: clip(task, 22),
    sectionKey: "ACTION",
    quote: clip(firstSentence(page.content.action ?? ""), 70),
  };
}

// Dev preview counterpart of POST /api/connections, with the same error codes.
export function buildConnection(
  books: Book[],
  pages: BookPage[],
  bookIds: number[],
  connectionId: number,
): CreatedConnection {
  if (
    bookIds.length < MIN_BOOKS ||
    bookIds.length > MAX_BOOKS ||
    new Set(bookIds).size !== bookIds.length
  )
    throw new ApiError("책은 서로 다른 2~3권을 선택해 주세요.", "INVALID_BOOK_COUNT", 400);
  const evidences = bookIds.map((id, i) => {
    if (!books.some((b) => b.bookId === id))
      throw new ApiError("책을 찾을 수 없어요.", "BOOK_NOT_FOUND", 404);
    const page = pages.find((p) => p.bookId === id && isReadyPage(p));
    if (!page)
      throw new ApiError("연결할 수 없는 책이 포함돼 있어요.", "BOOK_NOT_ELIGIBLE", 422);
    return evidenceFrom(page, connectionId * 10 + i);
  });
  return {
    connectionId,
    // Placeholder sentence; the server writes this with AI.
    suggestedSentence:
      "복잡한 정보를 정리해, 이해하기 쉬운 콘텐츠로 전달하는 경험을 쌓아왔습니다.",
    bookCount: bookIds.length,
    evidences,
  };
}

export const savedDate = (date: string) =>
  `${date.slice(0, 10).replaceAll("-", ".")} 저장`;
export const foundText = (count: number, isFirst: boolean) =>
  `${isFirst ? "첫 연결 · " : ""}${count}권의 기록에서 찾았어요`;
