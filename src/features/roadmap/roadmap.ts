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

export interface Bar {
  book: Book;
  left: number; // percent of the year
  width: number; // percent of the year
  lane: number;
}
export const MIN_BAR_WIDTH = 20;

// Places one category's books on the year axis, stacking overlaps into lanes.
export function layoutBars(books: Book[], year: number, today: string) {
  const [from, to] = yearBounds(year);
  const total = to + DAY - from;
  const bars = booksInYear(books, year, today)
    .map((book) => {
      const { start, end } = span(book, today);
      let left = ((Math.max(start, from) - from) / total) * 100;
      const right = ((Math.min(end, to) + DAY - from) / total) * 100;
      const width = Math.max(right - left, MIN_BAR_WIDTH);
      left = Math.min(left, 100 - width);
      return { book, left, width, lane: 0 };
    })
    .sort((a, b) => a.left - b.left || b.width - a.width);
  const laneEnds: number[] = [];
  for (const bar of bars) {
    let lane = laneEnds.findIndex((end) => end <= bar.left + 0.01);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = bar.left + bar.width;
    bar.lane = lane;
  }
  return { bars, lanes: laneEnds.length };
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

export function yearOptions(books: Book[], thisYear: number) {
  let min = thisYear - 2,
    max = thisYear + 2;
  for (const b of books) {
    min = Math.min(min, Number(b.startDate.slice(0, 4)));
    if (b.endDate) max = Math.max(max, Number(b.endDate.slice(0, 4)));
  }
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}
