import test from "node:test";
import assert from "node:assert/strict";
import { createActivityApi, ApiError } from "../src/features/activity/api.ts";

const envelope = (data) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
test("uses the current access token, exact sort query, and unwraps the envelope", async (t) => {
  let token = "first";
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, init });
    return envelope([{ bookId: 7 }]);
  });
  const api = createActivityApi({
    baseUrl: "https://api.example.test/",
    getAccessToken: () => token,
  });
  assert.deepEqual(await api.books("CATEGORY"), [{ bookId: 7 }]);
  token = "renewed";
  await api.books("OLDEST");
  assert.equal(
    calls[0].url,
    "https://api.example.test/api/books?sort=CATEGORY",
  );
  assert.equal(calls[1].init.headers.get("Authorization"), "Bearer renewed");
});
test("sends all book fields, retaining an explicitly absent end date", async (t) => {
  let body;
  t.mock.method(globalThis, "fetch", async (_, init) => {
    body = JSON.parse(init.body);
    assert.equal(init.method, "PATCH");
    return envelope(body);
  });
  const api = createActivityApi({
    baseUrl: "https://api.example.test",
    getAccessToken: () => "token",
  });
  const input = {
    title: "나의 기록",
    startDate: "2026-10-01",
    endDate: null,
    category: "ETC",
  };
  await api.updateBook(9, input);
  assert.deepEqual(body, input);
});
test("lets the browser set the multipart boundary and uses file as the field name", async (t) => {
  const file = new File(["a"], "note.pdf", { type: "application/pdf" });
  t.mock.method(globalThis, "fetch", async (_, init) => {
    assert.equal(init.headers.has("Content-Type"), false);
    assert.equal(init.body.get("file").name, "note.pdf");
    return envelope({ attachmentId: 1 });
  });
  const api = createActivityApi({
    baseUrl: "https://api.example.test",
    getAccessToken: () => "token",
  });
  assert.deepEqual(await api.upload(1, file), { attachmentId: 1 });
});
test("missing configuration or authentication never makes a network call", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw new Error("unexpected network request");
  });
  const noServer = createActivityApi({
    baseUrl: "",
    getAccessToken: () => "token",
  });
  await assert.rejects(
    noServer.books("LATEST"),
    (e) => e.code === "API_NOT_CONFIGURED",
  );
  let unauthorized = false;
  const noToken = createActivityApi({
    baseUrl: "https://api.example.test",
    getAccessToken: () => null,
    onUnauthorized: () => {
      unauthorized = true;
    },
  });
  await assert.rejects(noToken.books("LATEST"), (e) => e.status === 401);
  assert.equal(unauthorized, true);
  assert.equal(fetch.mock.callCount(), 0);
});
test("preserves server error codes and handles expired authentication", async (t) => {
  let unauthorized = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          success: false,
          code: "UNAUTHORIZED",
          message: "만료된 로그인",
        }),
        { status: 401 },
      ),
  );
  const api = createActivityApi({
    baseUrl: "https://api.example.test",
    getAccessToken: () => "expired",
    onUnauthorized: () => unauthorized++,
  });
  await assert.rejects(
    api.books("LATEST"),
    (e) =>
      e instanceof ApiError &&
      e.code === "UNAUTHORIZED" &&
      e.message === "만료된 로그인",
  );
  assert.equal(unauthorized, 1);
});
test("uses the deletion response instead of guessing whether the book still exists", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    envelope({ bookId: 3, bookDeleted: true }),
  );
  const api = createActivityApi({
    baseUrl: "https://api.example.test",
    getAccessToken: () => "token",
  });
  assert.deepEqual(await api.deletePage(10), { bookId: 3, bookDeleted: true });
});
