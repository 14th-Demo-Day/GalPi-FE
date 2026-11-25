import test from "node:test";
import assert from "node:assert/strict";
import {
  booksInQuarter,
  booksInYear,
  isOngoing,
  placeBars,
  buildRoadmap,
  bookStatus,
  buildBookDetail,
  listPeriod,
  searchBooks,
  buildYears,
  buildQuarter,
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

const bar = (bookId, startDate, endDate, lane = 0) => ({
  bookId,
  title: `책${bookId}`,
  startDate,
  endDate,
  lane,
});
const pos = (placed, id) => placed.find((p) => p.bar.bookId === id);

test("places server bars on the year axis, clipped to the year", () => {
  const placed = placeBars(
    {
      category: "CLUB",
      laneCount: 2,
      bars: [
        bar(1, "2026-01-01", "2026-06-30"),
        bar(2, "2025-10-01", "2026-03-31", 1),
        bar(3, "2026-09-01", "2027-02-28", 0),
      ],
    },
    2026,
  );
  assert.equal(pos(placed, 1).left, 0);
  assert.ok(Math.abs(pos(placed, 1).width - (181 / 365) * 100) < 0.01);
  assert.equal(pos(placed, 2).left, 0);
  assert.ok(Math.abs(pos(placed, 2).width - (90 / 365) * 100) < 0.01);
  const third = pos(placed, 3);
  assert.ok(Math.abs(third.left + third.width - 100) < 0.01);
});

test("a bar without an end date fills only its start quarter", () => {
  const [p] = placeBars(
    { category: "CLUB", laneCount: 1, bars: [bar(1, "2026-10-01", null)] },
    2026,
  );
  assert.ok(Math.abs(p.left - (273 / 365) * 100) < 0.01);
  assert.ok(Math.abs(p.left + p.width - 100) < 0.01);
});

test("short bars widen for readability without covering the next bar", () => {
  const placed = placeBars(
    {
      category: "CONTEST",
      laneCount: 1,
      bars: [bar(1, "2026-03-01", "2026-03-05"), bar(2, "2026-04-01", "2026-12-31")],
    },
    2026,
  );
  const a = pos(placed, 1), b = pos(placed, 2);
  assert.ok(a.width > (5 / 365) * 100);
  assert.ok(a.left + a.width <= b.left + 1e-9);
  const [end] = placeBars(
    { category: "STUDY", laneCount: 1, bars: [bar(9, "2026-12-28", "2026-12-30")] },
    2026,
  );
  assert.equal(end.width, MIN_BAR_WIDTH);
  assert.ok(Math.abs(end.left + end.width - 100) < 1e-9);
});

test("preview roadmap matches the API shape: 5 rows, ETC excluded, lanes", () => {
  const data = buildRoadmap(
    [
      { bookId: 3, title: "멋사", category: "CLUB", startDate: "2026-09-01", endDate: "2026-12-20" },
      { bookId: 7, title: "리서치", category: "CLUB", startDate: "2026-10-01", endDate: "2026-11-30" },
      { bookId: 8, title: "기타", category: "ETC", startDate: "2026-10-01", endDate: null },
      { bookId: 9, title: "작년", category: "STUDY", startDate: "2025-01-01", endDate: "2025-02-01" },
    ],
    2026,
  );
  assert.equal(data.year, 2026);
  assert.deepEqual(data.rows.map((r) => r.category), ["EXTERNAL", "CAMPUS", "CLUB", "CONTEST", "STUDY"]);
  const club = data.rows[2];
  assert.equal(club.laneCount, 2);
  assert.deepEqual(club.bars.map((b) => [b.bookId, b.lane]), [[3, 0], [7, 1]]);
  assert.deepEqual(data.rows[4], { category: "STUDY", laneCount: 0, bars: [] });
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
  const { currentYear, years } = buildYears(books, 2026, today);
  assert.equal(currentYear, 2026);
  assert.deepEqual(years.map((y) => y.year), [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031]);
  assert.deepEqual(years.filter((y) => y.hasRecord).map((y) => y.year), [2024, 2025, 2026]);
});

test("book status: COMPLETED only when the end date is before today", () => {
  assert.equal(bookStatus("2026-11-23", "2026-11-24"), "COMPLETED");
  assert.equal(bookStatus("2026-11-24", "2026-11-24"), "IN_PROGRESS");
  assert.equal(bookStatus(null, "2026-11-24"), "IN_PROGRESS");
  assert.deepEqual(
    buildBookDetail(
      { bookId: 3, title: "멋사 데모데이", category: "CLUB", startDate: "2026-09-01", endDate: "2026-12-20" },
      4,
      "2026-11-24",
    ),
    {
      bookId: 3,
      title: "멋사 데모데이",
      category: "CLUB",
      status: "IN_PROGRESS",
      startDate: "2026-09-01",
      endDate: "2026-12-20",
      pageCount: 4,
    },
  );
});

test("preview quarter list: overlap, ETC excluded, keyword, start ascending", () => {
  const books = [
    { bookId: 1, title: "멋사 데모데이", category: "CLUB", startDate: "2026-11-01", endDate: "2026-12-20" },
    { bookId: 2, title: "멋사 스터디", category: "STUDY", startDate: "2026-09-01", endDate: "2026-10-15" },
    { bookId: 3, title: "기타 메모", category: "ETC", startDate: "2026-10-01", endDate: "2026-10-02" },
    { bookId: 4, title: "봄 공모전", category: "CONTEST", startDate: "2026-03-01", endDate: "2026-04-01" },
  ];
  assert.deepEqual(buildQuarter(books, 2026, 4, "", today).map((b) => b.bookId), [2, 1]);
  assert.deepEqual(buildQuarter(books, 2026, 4, "데모", today).map((b) => b.bookId), [1]);
  assert.deepEqual(buildQuarter(books, 2026, 4, "독서", today), []);
  assert.deepEqual(Object.keys(buildQuarter(books, 2026, 2, "", today)[0]).sort(), ["bookId", "category", "endDate", "startDate", "title"]);
});
