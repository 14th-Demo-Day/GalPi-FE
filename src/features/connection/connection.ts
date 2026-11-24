import type { Book, BookPage } from "../activity/types";

export const MIN_FIELD_LENGTH = 20;
export const MIN_BOOKS = 2;
// T·A·R of one activity page must each be long enough to connect.
export const REQUIRED_FIELDS = ["task", "action", "result"] as const;

export interface Evidence {
  bookId: number;
  bookTitle: string;
  pageId: number;
  label: string;
  quote: string;
}
export interface Candidate {
  book: Book;
  evidence: Evidence;
}
export interface ConnectionResult {
  sentence: string;
  evidence: Evidence[];
  isFirst: boolean;
}
export interface SavedSentence {
  id: number;
  sentence: string;
  evidence: Evidence[];
  isFirst: boolean;
  savedAt: string; // YYYY-MM-DD
}

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

export function evidenceFrom(page: BookPage): Evidence {
  const task = firstSentence(page.content.task ?? "").split(/[,.]/)[0];
  return {
    bookId: page.bookId,
    bookTitle: page.bookTitle,
    pageId: page.pageId,
    label: `활동 · ${clip(task, 22)}`,
    quote: clip(firstSentence(page.content.action ?? ""), 70),
  };
}

export const savedDate = (date: string) =>
  `${date.slice(0, 10).replaceAll("-", ".")} 저장`;
export const foundText = (count: number, isFirst: boolean) =>
  `${isFirst ? "첫 연결 · " : ""}${count}권의 기록에서 찾았어요`;
