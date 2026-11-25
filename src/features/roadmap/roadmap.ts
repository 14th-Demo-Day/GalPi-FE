import type { Book, Category } from "../activity/types";

export type Quarter = 1 | 2 | 3 | 4;
export const quarters: Quarter[] = [1, 2, 3, 4];
export const quarterMonths: Record<Quarter, string> = {
  1: "1–3월",
  2: "4–6월",
  3: "7–9월",
  4: "10–12월",
};
// Rows shown in the annual grid, in Figma order. ETC appears only when used.
export const roadmapRows: { category: Category; label: string }[] = [
  { category: "EXTERNAL", label: "대외\n활동" },
  { category: "CAMPUS", label: "교내\n활동" },
  { category: "CLUB", label: "동아리" },
  { category: "CONTEST", label: "공모전" },
  { category: "STUDY", label: "학습" },
  { category: "ETC", label: "기타" },
];

const DAY = 86_400_000;
const day = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const todayString = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
export const currentQuarter = (now = new Date()) =>
  (Math.floor(now.getMonth() / 3) + 1) as Quarter;

// An open-ended book runs until today (or its start, if it starts in the future).
function span(book: Book, today: string) {
  const start = day(book.startDate);
  const end = book.endDate ? day(book.endDate) : Math.max(day(today), start);
  return { start, end: Math.max(start, end) };
}
function overlaps(book: Book, from: number, to: number, today: string) {
  const { start, end } = span(book, today);
  return start <= to && end >= from;
}
const yearBounds = (year: number) =>
  [Date.UTC(year, 0, 1), Date.UTC(year, 11, 31)] as const;
const quarterBounds = (year: number, q: Quarter) =>
  [Date.UTC(year, (q - 1) * 3, 1), Date.UTC(year, q * 3, 0)] as const;

export const isOngoing = (book: Book, today: string) =>
  book.startDate.slice(0, 10) <= today &&
  (!book.endDate || book.endDate.slice(0, 10) >= today);

export function booksInYear(books: Book[], year: number, today: string) {
  const [from, to] = yearBounds(year);
  return books.filter((b) => overlaps(b, from, to, today));
}

export function booksInQuarter(
  books: Book[],
  year: number,
  q: Quarter,
  today: string,
) {
  const [from, to] = quarterBounds(year, q);
  return books
    .filter((b) => overlaps(b, from, to, today))
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.title.localeCompare(b.title, "ko"),
    );
}

export function searchBooks(books: Book[], query: string) {
  const q = query.trim().toLowerCase();
  return q ? books.filter((b) => b.title.toLowerCase().includes(q)) : books;
}

// GET /api/roadmap?year= response (data). Rows always come in the order
// EXTERNAL, CAMPUS, CLUB, CONTEST, STUDY; ETC books are excluded by the server.
export interface RoadmapBar {
  bookId: number;
  title: string;
  startDate: string;
  endDate: string | null;
  lane: number;
}
export interface RoadmapRow {
  category: Category;
  laneCount: number;
  bars: RoadmapBar[];
}
export interface RoadmapData {
  year: number;
  rows: RoadmapRow[];
}

export const MIN_BAR_WIDTH = 20;

// Year-axis range of a bar in percent, before readability adjustments.
// The server returns any book overlapping the year, so clip to the year here.
// Without an end date, fill only the quarter the book starts in.
function barRange(bar: RoadmapBar, year: number) {
  const [from, to] = yearBounds(year);
  const total = to + DAY - from;
  const pct = (t: number) => ((t - from) / total) * 100;
  const start = day(bar.startDate);
  if (!bar.endDate) {
    const q = start < from ? 1 : (Math.floor(new Date(start).getUTCMonth() / 3) + 1) as Quarter;
    const [qFrom, qTo] = quarterBounds(year, q);
    return { left: pct(qFrom), right: pct(qTo + DAY) };
  }
  const end = Math.max(day(bar.endDate), start);
  return {
    left: pct(Math.max(start, from)),
    right: pct(Math.min(end, to) + DAY),
  };
}

export interface PlacedBar {
  bar: RoadmapBar;
  left: number; // percent of the year
  width: number; // percent of the year
}

// Positions one row's bars. Lanes come from the server; short bars are widened
// to stay readable, but never into the next bar on the same lane.
export function placeBars(row: RoadmapRow, year: number) {
  const placed: PlacedBar[] = [];
  const lanes = new Map<number, { bar: RoadmapBar; left: number; right: number }[]>();
  for (const bar of row.bars) {
    const list = lanes.get(bar.lane) ?? [];
    list.push({ bar, ...barRange(bar, year) });
    lanes.set(bar.lane, list);
  }
  for (const list of lanes.values()) {
    list.sort((a, b) => a.left - b.left);
    let prevEnd = 0;
    list.forEach((item, i) => {
      const nextLeft = i + 1 < list.length ? list[i + 1].left : 100;
      const desired = Math.max(item.right - item.left, MIN_BAR_WIDTH);
      const left = Math.max(prevEnd, Math.min(item.left, 100 - desired));
      const width = Math.max(
        Math.min(desired, nextLeft - left, 100 - left),
        item.right - item.left,
      );
      placed.push({ bar: item.bar, left, width });
      prevEnd = left + width;
    });
  }
  return placed;
}

export const ROADMAP_CATEGORIES: Category[] = [
  "EXTERNAL",
  "CAMPUS",
  "CLUB",
  "CONTEST",
  "STUDY",
];

// Builds the same response shape locally, for the dev preview API.
export function buildRoadmap(books: Book[], year: number): RoadmapData {
  const [from, to] = yearBounds(year);
  const quarterEnd = (start: number) => {
    const d = new Date(start);
    return Date.UTC(d.getUTCFullYear(), (Math.floor(d.getUTCMonth() / 3) + 1) * 3, 0);
  };
  return {
    year,
    rows: ROADMAP_CATEGORIES.map((category) => {
      const items = books
        .filter((b) => b.category === category)
        .map((b) => {
          const start = day(b.startDate);
          const end = b.endDate ? day(b.endDate) : quarterEnd(start);
          return { b, start, end: Math.max(start, end) };
        })
        .filter(({ start, end }) => start <= to && end >= from)
        .sort((x, y) => x.start - y.start || x.end - y.end);
      const laneEnds: number[] = [];
      const bars = items.map(({ b, start, end }) => {
        let lane = laneEnds.findIndex((e) => e < start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = end;
        return {
          bookId: b.bookId,
          title: b.title,
          startDate: b.startDate.slice(0, 10),
          endDate: b.endDate ? b.endDate.slice(0, 10) : null,
          lane,
        };
      });
      return { category, laneCount: laneEnds.length, bars };
    }),
  };
}

// GET /api/roadmap/quarter?year=&quarter=&keyword= response (data): books
// overlapping the quarter, ETC excluded, sorted by start date ascending.
export type QuarterBook = Pick<
  Book,
  "bookId" | "title" | "category" | "startDate" | "endDate"
>;

// Dev preview counterpart of the quarterly endpoint.
export function buildQuarter(
  books: Book[],
  year: number,
  q: Quarter,
  keyword: string,
  today: string,
): QuarterBook[] {
  return searchBooks(
    booksInQuarter(books, year, q, today).filter((b) => b.category !== "ETC"),
    keyword,
  ).map(({ bookId, title, category, startDate, endDate }) => ({
    bookId,
    title,
    category,
    startDate: startDate.slice(0, 10),
    endDate: endDate ? endDate.slice(0, 10) : null,
  }));
}

// GET /api/roadmap/books/{bookId} response (data), shared with the quarterly list.
export interface RoadmapBookDetail {
  bookId: number;
  title: string;
  category: Category;
  status: "IN_PROGRESS" | "COMPLETED";
  startDate: string;
  endDate: string | null;
  pageCount: number;
}

// Server rule: COMPLETED when the end date is before today, else IN_PROGRESS.
export const bookStatus = (
  endDate: string | null,
  today: string,
): RoadmapBookDetail["status"] =>
  endDate && endDate.slice(0, 10) < today ? "COMPLETED" : "IN_PROGRESS";

// Dev preview counterpart of the detail endpoint.
export function buildBookDetail(
  book: Book,
  pageCount: number,
  today: string,
): RoadmapBookDetail {
  return {
    bookId: book.bookId,
    title: book.title,
    category: book.category,
    status: bookStatus(book.endDate, today),
    startDate: book.startDate.slice(0, 10),
    endDate: book.endDate ? book.endDate.slice(0, 10) : null,
    pageCount,
  };
}

const md = (date: string) => date.slice(5, 10).replace("-", ".");
// Period as shown in the quarterly list, with a note when it crosses the year.
export function listPeriod(book: Book, year: number) {
  const startYear = Number(book.startDate.slice(0, 4));
  const endYear = book.endDate ? Number(book.endDate.slice(0, 4)) : null;
  const notes = [
    startYear !== year && `${startYear}년부터`,
    endYear !== null && endYear !== year && `${endYear}년까지`,
  ].filter(Boolean);
  return {
    text: `${md(book.startDate)} ~ ${book.endDate ? md(book.endDate) : "진행 중"}`,
    note: notes.join(" · "),
  };
}

// GET /api/roadmap/years response (data): this year ±5, with record flags.
export interface RoadmapYears {
  currentYear: number;
  years: { year: number; hasRecord: boolean }[];
}
export const YEAR_SPAN = 5;

// Same shape built locally: the dev preview API, and a fallback if the
// request fails so the picker still works.
export function buildYears(
  books: Book[],
  currentYear: number,
  today: string,
): RoadmapYears {
  return {
    currentYear,
    years: Array.from({ length: YEAR_SPAN * 2 + 1 }, (_, i) => {
      const year = currentYear - YEAR_SPAN + i;
      return { year, hasRecord: booksInYear(books, year, today).length > 0 };
    }),
  };
}
