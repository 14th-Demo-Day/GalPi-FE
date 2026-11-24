import test from "node:test";
import assert from "node:assert/strict";
import {
  booksInQuarter,
  booksInYear,
  isOngoing,
  layoutBars,
  listPeriod,
  searchBooks,
  yearOptions,
  MIN_BAR_WIDTH,
} from "../src/features/roadmap/roadmap.ts";

const book = (bookId, title, startDate, endDate, category = "CLUB") => ({
  bookId,
  title,
  startDate,
  endDate,
  category,
});
const today = "2026-11-24";

test("filters books by year and quarter overlap, including year-crossing ones", () => {
  const books = [
    book(1, "매거진", "2026-09-01", "2027-02-28"),
    book(2, "스터디", "2026-01-10", "2026-03-31"),
    book(3, "작년", "2025-03-01", "2025-05-01"),
  ];
  assert.deepEqual(booksInYear(books, 2026, today).map((b) => b.bookId), [1, 2]);
  assert.deepEqual(booksInYear(books, 2027, today).map((b) => b.bookId), [1]);
  assert.deepEqual(booksInQuarter(books, 2026, 1, today).map((b) => b.bookId), [2]);
  assert.deepEqual(booksInQuarter(books, 2026, 3, today).map((b) => b.bookId), [1]);
  assert.deepEqual(booksInQuarter(books, 2026, 2, today), []);
});

test("open-ended books run until today", () => {
  const open = book(1, "진행", "2026-02-01", null);
  assert.equal(booksInQuarter([open], 2026, 4, today).length, 1);
  assert.equal(booksInYear([open], 2027, today).length, 0);
  assert.equal(isOngoing(open, today), true);
  assert.equal(isOngoing(book(2, "끝", "2026-01-01", "2026-02-01"), today), false);
});

test("stacks overlapping bars into lanes and keeps short bars readable", () => {
  const { bars, lanes } = layoutBars(
    [
      book(1, "A", "2026-01-01", "2026-06-30"),
      book(2, "B", "2026-03-01", "2026-09-30"),
      book(3, "C", "2026-07-01", "2026-12-31"),
      book(4, "D", "2026-12-28", "2026-12-30"),
    ],
    2026,
    today,
  );
  const byId = Object.fromEntries(bars.map((b) => [b.book.bookId, b]));
  assert.equal(byId[1].lane, 0);
  assert.equal(byId[2].lane, 1);
  assert.equal(byId[3].lane, 0);
  assert.equal(byId[1].left, 0);
  assert.ok(Math.abs(byId[1].width - (181 / 365) * 100) < 0.01);
  assert.equal(byId[4].width, MIN_BAR_WIDTH);
  assert.equal(byId[4].left + byId[4].width, 100);
  assert.equal(byId[4].lane, 1);
  assert.equal(lanes, 2);
});

test("clips bars that cross the year boundary", () => {
  const { bars } = layoutBars([book(1, "A", "2025-10-01", "2026-03-31")], 2026, today);
  assert.equal(bars[0].left, 0);
  assert.ok(Math.abs(bars[0].width - (90 / 365) * 100) < 0.01);
});

test("formats list periods with year notes", () => {
  assert.deepEqual(listPeriod(book(1, "A", "2026-09-01", "2027-02-28"), 2026), {
    text: "09.01 ~ 02.28",
    note: "2027년까지",
  });
  assert.deepEqual(listPeriod(book(1, "A", "2026-09-01", null), 2026), {
    text: "09.01 ~ 진행 중",
    note: "",
  });
});

test("searches titles and builds the year range", () => {
  const books = [book(1, "동아리 매거진", "2024-01-01", "2026-01-01"), book(2, "해커톤", "2026-01-01", "2026-02-01")];
  assert.deepEqual(searchBooks(books, " 동아리 ").map((b) => b.bookId), [1]);
  assert.equal(searchBooks(books, "").length, 2);
  assert.deepEqual(yearOptions([], 2026), [2024, 2025, 2026, 2027, 2028]);
  assert.deepEqual(yearOptions([book(1, "A", "2021-05-01", "2029-01-01")], 2026).at(0), 2021);
});
