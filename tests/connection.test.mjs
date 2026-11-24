import test from "node:test";
import assert from "node:assert/strict";
import {
  evidenceFrom,
  foundText,
  isReadyPage,
  savedDate,
} from "../src/features/connection/connection.ts";
import {
  ConnectionError,
  createLocalConnectionApi,
} from "../src/features/connection/api.ts";

const long = "가".repeat(20);
const page = (content, pageType = "ACTIVITY", extra = {}) => ({
  pageId: 1,
  bookId: 1,
  bookTitle: "동아리 매거진",
  pageType,
  content,
  ...extra,
});

test("a page is ready only when T, A and R each have 20+ characters", () => {
  assert.equal(isReadyPage(page({ task: long, action: long, result: long })), true);
  assert.equal(isReadyPage(page({ task: long, action: long, result: "가".repeat(19) })), false);
  assert.equal(isReadyPage(page({ task: long, action: long, result: ` ${"가".repeat(19)} ` })), false);
  assert.equal(isReadyPage(page({ task: long, action: long })), false);
  assert.equal(isReadyPage(page({ task: long, action: long, result: long }, "INSIGHT")), false);
});

test("evidence quotes the first sentence of the action", () => {
  const e = evidenceFrom(
    page({
      task: "인터뷰 콘텐츠 제작을 맡았다. 일정도 관리했다.",
      action: "인터뷰 답변을 주제별로 분류했다. 카드뉴스로 구성했다.",
      result: long,
    }),
  );
  assert.equal(e.label, "활동 · 인터뷰 콘텐츠 제작을 맡았다");
  assert.equal(e.quote, "인터뷰 답변을 주제별로 분류했다.");
  assert.equal(e.pageId, 1);
});

test("formats the found and saved texts", () => {
  assert.equal(foundText(2, true), "첫 연결 · 2권의 기록에서 찾았어요");
  assert.equal(foundText(3, false), "3권의 기록에서 찾았어요");
  assert.equal(savedDate("2026-09-30"), "2026.09.30 저장");
});

test("local api lists only books with a ready activity page", async () => {
  const books = [
    { bookId: 1, title: "A", category: "CLUB", startDate: "2026-09-01", endDate: null },
    { bookId: 2, title: "B", category: "STUDY", startDate: "2026-09-01", endDate: null },
  ];
  const pages = {
    1: [{ pageId: 11, pageType: "MEMO" }, { pageId: 12, pageType: "ACTIVITY" }],
    2: [{ pageId: 21, pageType: "ACTIVITY" }],
  };
  const content = {
    12: { task: long, action: long, result: long },
    21: { task: long, action: "짧음", result: long },
  };
  const api = createLocalConnectionApi({
    books: async () => books,
    pages: async (id) => ({ bookId: id, bookTitle: "", pages: pages[id] }),
    page: async (id) => ({
      pageId: id,
      bookId: id === 12 ? 1 : 2,
      bookTitle: id === 12 ? "A" : "B",
      pageType: "ACTIVITY",
      content: content[id],
    }),
  });
  const { total, candidates } = await api.books();
  assert.equal(total, 2);
  assert.deepEqual(candidates.map((c) => c.book.bookId), [1]);
  assert.equal(candidates[0].evidence.pageId, 12);
});

test("generation can be cancelled, and saved sentences can be edited", async () => {
  const api = createLocalConnectionApi({});
  const c = new AbortController();
  const pending = api.generate([], c.signal);
  c.abort();
  await assert.rejects(pending, { name: "AbortError" });

  const item = await api.save({ sentence: "문장", evidence: [], isFirst: true });
  assert.match(item.savedAt, /^\d{4}-\d{2}-\d{2}$/);
  await api.update(item.id, "고친 문장");
  assert.equal((await api.saved())[0].sentence, "고친 문장");
  await assert.rejects(api.update(999, "x"), ConnectionError);
});
