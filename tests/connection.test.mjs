import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConnection,
  buildEligibleBooks,
  evidenceFrom,
  foundText,
  isDarkColor,
  isReadyPage,
  savedDate,
} from "../src/features/connection/connection.ts";
import {
  ConnectionError,
  createLocalConnectionApi,
} from "../src/features/connection/api.ts";
import { ApiError } from "../src/features/activity/api.ts";

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
  assert.equal(e.pageTitle, "인터뷰 콘텐츠 제작을 맡았다");
  assert.equal(e.pageType, "ACTIVITY");
  assert.equal(e.sectionKey, "ACTION");
  assert.equal(e.quote, "인터뷰 답변을 주제별로 분류했다.");
  assert.equal(e.pageId, 1);
});

test("formats the found and saved texts", () => {
  assert.equal(foundText(2, true), "첫 연결 · 2권의 기록에서 찾았어요");
  assert.equal(foundText(3, false), "3권의 기록에서 찾았어요");
  assert.equal(savedDate("2026-09-30"), "2026.09.30 저장");
});

test("books come from the eligible-books endpoint, plus whether any book exists", async () => {
  const calls = [];
  const eligible = { canConnect: false, eligibleCount: 0, books: [] };
  let allBooks = [];
  const api = createLocalConnectionApi({
    request: async (path) => {
      calls.push(path);
      return eligible;
    },
    books: async () => allBooks,
  });
  assert.deepEqual(await api.books(), { data: eligible, hasBooks: false });
  assert.deepEqual(calls, ["/api/connections/eligible-books"]);
  allBooks = [{ bookId: 1 }];
  assert.equal((await api.books()).hasBooks, true);
});

test("preview eligible books: ready activity page required, hex cover colors", () => {
  const books = [
    { bookId: 3, title: "동아리 매거진", category: "CLUB", startDate: "2026-09-01", endDate: null, coverColor: "GREEN" },
    { bookId: 5, title: "통계 스터디", category: "STUDY", startDate: "2026-09-01T00:00:00", endDate: null, coverColor: "SAGE" },
    { bookId: 6, title: "메모만", category: "ETC", startDate: "2026-09-01", endDate: null },
  ];
  const ready = { task: long, action: long, result: long };
  const data = buildEligibleBooks(books, [
    { bookId: 3, pageType: "ACTIVITY", content: ready },
    { bookId: 5, pageType: "ACTIVITY", content: ready },
    { bookId: 6, pageType: "MEMO", content: ready },
  ]);
  assert.equal(data.canConnect, true);
  assert.equal(data.eligibleCount, 2);
  assert.deepEqual(data.books[1], {
    bookId: 5,
    title: "통계 스터디",
    category: "STUDY",
    startDate: "2026-09-01",
    coverColor: "#E5EDE6",
  });
  assert.equal(buildEligibleBooks(books.slice(0, 1), [{ bookId: 3, pageType: "ACTIVITY", content: ready }]).canConnect, false);
  assert.equal(isDarkColor("#2F5D4A"), true);
  assert.equal(isDarkColor("#E5EDE6"), false);
});

const created = {
  connectionId: 15,
  suggestedSentence: "복잡한 정보를 정리해, 이해하기 쉬운 콘텐츠로 전달하는 경험을 쌓아왔습니다.",
  bookCount: 2,
  evidences: [
    { evidenceId: 40, bookId: 3, bookTitle: "동아리 매거진", pageId: 21, pageType: "ACTIVITY", pageTitle: "인터뷰 콘텐츠 제작", sectionKey: "ACTION", quote: "인터뷰 답변을 주제별로 분류하고, 핵심 내용을 카드뉴스로 구성했다." },
    { evidenceId: 41, bookId: 5, bookTitle: "통계 스터디", pageId: 34, pageType: "ACTIVITY", pageTitle: "설문 결과 정리", sectionKey: "ACTION", quote: "설문 결과를 표와 그래프로 정리하고, 팀원이 이해하기 쉽게 설명했다." },
  ],
};

test("generation posts the book ids and maps the response", async () => {
  const calls = [];
  const api = createLocalConnectionApi({
    request: async (path, init) => {
      calls.push({ path, method: init.method, body: JSON.parse(init.body) });
      return created;
    },
  });
  const result = await api.generate([{ bookId: 3 }, { bookId: 5 }]);
  assert.deepEqual(calls, [{ path: "/api/connections", method: "POST", body: { bookIds: [3, 5] } }]);
  assert.equal(result.connectionId, 15);
  assert.equal(result.sentence, created.suggestedSentence);
  assert.deepEqual(result.evidence[0], {
    evidenceId: 40,
    bookId: 3,
    bookTitle: "동아리 매거진",
    pageId: 21,
    label: "활동 · 인터뷰 콘텐츠 제작",
    quote: "인터뷰 답변을 주제별로 분류하고, 핵심 내용을 카드뉴스로 구성했다.",
  });
});

test("server error codes pick the failure screen; cancel stays an abort", async () => {
  const failing = (error) =>
    createLocalConnectionApi({ request: async () => { throw error; } }).generate([{ bookId: 1 }, { bookId: 2 }]);
  for (const [code, status, kind] of [
    ["AI_GENERATION_FAILED", 502, "RECORD"],
    ["INSUFFICIENT_EVIDENCE", 422, "RECORD"],
    ["BOOK_NOT_ELIGIBLE", 422, "RECORD"],
    ["BOOK_NOT_FOUND", 404, "SERVER"],
    ["INVALID_BOOK_COUNT", 400, "SERVER"],
    ["NETWORK_ERROR", 0, "SERVER"],
  ])
    await assert.rejects(failing(new ApiError("x", code, status)), (e) => e instanceof ConnectionError && e.kind === kind && e.code === code);
  await assert.rejects(failing(new DOMException("Aborted", "AbortError")), { name: "AbortError" });
});

test("preview builder mirrors the endpoint's validation", () => {
  const books = [1, 2, 3, 4].map((bookId) => ({ bookId, title: `책${bookId}`, category: "CLUB", startDate: "2026-09-01", endDate: null }));
  const ready = { task: long, action: long, result: long };
  const pages = [1, 2, 3, 4].map((bookId) => ({ pageId: bookId * 10, bookId, bookTitle: `책${bookId}`, pageType: "ACTIVITY", content: bookId === 4 ? {} : ready }));
  const ok = buildConnection(books, pages, [1, 2], 7);
  assert.equal(ok.connectionId, 7);
  assert.equal(ok.bookCount, 2);
  assert.deepEqual(ok.evidences.map((e) => e.pageId), [10, 20]);
  assert.throws(() => buildConnection(books, pages, [1], 1), { code: "INVALID_BOOK_COUNT" });
  assert.throws(() => buildConnection(books, pages, [1, 1], 1), { code: "INVALID_BOOK_COUNT" });
  assert.throws(() => buildConnection(books, pages, [1, 2, 3, 4], 1), { code: "INVALID_BOOK_COUNT" });
  assert.throws(() => buildConnection(books, pages, [1, 9], 1), { code: "BOOK_NOT_FOUND" });
  assert.throws(() => buildConnection(books, pages, [1, 4], 1), { code: "BOOK_NOT_ELIGIBLE" });
});

test("saving posts the trimmed final sentence", async () => {
  const calls = [];
  const api = createLocalConnectionApi({
    request: async (path, init) => {
      calls.push({ path, method: init.method, body: JSON.parse(init.body) });
      return { connectionId: 15, finalSentence: "다듬은 문장", savedAt: "2026-09-30T10:00:00" };
    },
  });
  const r = await api.save(15, "  다듬은 문장 ");
  assert.deepEqual(calls, [{ path: "/api/connections/15/save", method: "POST", body: { finalSentence: "다듬은 문장" } }]);
  assert.equal(r.finalSentence, "다듬은 문장");
});

test("saved list is paged from the server and mapped for the cards", async () => {
  const paths = [];
  const api = createLocalConnectionApi({
    request: async (path) => {
      paths.push(path);
      return {
        totalCount: 2,
        page: 0,
        size: 20,
        hasNext: false,
        items: [
          { connectionId: 15, finalSentence: "복잡한 정보를 정리해", savedAt: "2026-09-30T10:00:00", bookTitles: ["동아리 매거진", "통계 스터디"] },
        ],
      };
    },
  });
  const page = await api.saved();
  await api.saved(2);
  assert.deepEqual(paths, ["/api/connections/saved?page=0&size=20", "/api/connections/saved?page=2&size=20"]);
  assert.deepEqual(page, {
    totalCount: 2,
    page: 0,
    hasNext: false,
    items: [{ id: 15, sentence: "복잡한 정보를 정리해", savedAt: "2026-09-30", bookTitles: ["동아리 매거진", "통계 스터디"] }],
  });
});

test("result is fetched by id, preferring the edited final sentence", async () => {
  const detail = {
    connectionId: 15,
    suggestedSentence: "제안 문장",
    finalSentence: "다듬은 문장",
    saved: true,
    savedAt: "2026-09-30T10:00:00",
    evidences: [
      { evidenceId: 40, bookId: null, bookTitle: "동아리 매거진", pageId: null, pageType: "ACTIVITY", pageTitle: "인터뷰 콘텐츠 제작", sectionKey: "ACTION", quote: "인용" },
    ],
  };
  const paths = [];
  const api = createLocalConnectionApi({
    request: async (path) => {
      paths.push(path);
      return structuredClone(detail);
    },
  });
  const r = await api.result(15);
  assert.deepEqual(paths, ["/api/connections/15"]);
  assert.equal(r.connectionId, 15);
  assert.equal(r.saved, true);
  assert.equal(r.sentence, "다듬은 문장");
  assert.equal(r.evidence[0].pageId, null);
  assert.equal(r.evidence[0].label, "활동 · 인터뷰 콘텐츠 제작");
  detail.finalSentence = null;
  assert.equal((await api.result(15)).sentence, "제안 문장");
});
