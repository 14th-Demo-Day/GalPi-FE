import test from "node:test";
import assert from "node:assert/strict";
import { createAuthSession } from "../src/features/onboarding/session.ts";
import { createAuthApi } from "../src/features/onboarding/api.ts";
import { createActivityApi } from "../src/features/activity/api.ts";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
const credentials = { loginId: "reader", password: "test-only" };

test("login persists the token before protected requests and restores it after reload", async (t) => {
  const saved = storage();
  const session = createAuthSession(saved);
  const snapshots = [];
  const unsubscribe = session.subscribe(() => snapshots.push(session.getAccessToken()));
  const api = createActivityApi({
    baseUrl: "https://api.example.test",
    getAccessToken: session.getAccessToken,
    onUnauthorized: session.clear,
  });
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url === "https://api.example.test/api/auth/login") {
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(init.body), credentials);
      assert.equal(new Headers(init.headers).has("Authorization"), false);
      return Response.json({ success: true, data: { accessToken: "issued-token", tokenType: "Bearer" } });
    }
    assert.equal(url, "https://api.example.test/api/books?sort=LATEST");
    assert.equal(init.headers.get("Authorization"), "Bearer issued-token");
    return Response.json({ success: true, data: [{ bookId: 7 }] });
  });
  await session.login(credentials, createAuthApi("https://api.example.test/").login);
  assert.deepEqual(snapshots, ["issued-token"]);
  assert.deepEqual(await api.books("LATEST"), [{ bookId: 7 }]);
  assert.equal(createAuthSession(saved).getAccessToken(), "issued-token");
  unsubscribe();
  session.clear();
  assert.deepEqual(snapshots, ["issued-token"]);
});

test("missing adapter, failed login and missing tokens never establish a session", async () => {
  const session = createAuthSession(storage());
  await assert.rejects(session.login(credentials), /로그인 API/);
  await assert.rejects(session.login(credentials, async () => {
    throw new Error("잘못된 비밀번호");
  }), /잘못된 비밀번호/);
  for (const result of [null, {}, { accessToken: "" }, { accessToken: "  " }]) {
    await assert.rejects(session.login(credentials, async () => result), /인증 토큰/);
  }
  assert.equal(session.getAccessToken(), null);
});

test("server 401 clears persisted authentication and notifies the route guard", async (t) => {
  const saved = storage();
  const session = createAuthSession(saved);
  await session.login(credentials, async () => ({ accessToken: "expired" }));
  const snapshots = [];
  session.subscribe(() => snapshots.push(session.getAccessToken()));
  const api = createActivityApi({
    baseUrl: "https://api.example.test",
    getAccessToken: session.getAccessToken,
    onUnauthorized: session.clear,
  });
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ message: "만료된 로그인", code: "UNAUTHORIZED" }, { status: 401 }),
  );
  await assert.rejects(api.books("LATEST"), (e) => e.status === 401);
  assert.deepEqual(snapshots, [null]);
  assert.equal(createAuthSession(saved).getAccessToken(), null);
  await assert.rejects(api.books("LATEST"), (e) => e.status === 401);
  assert.equal(fetch.mock.callCount(), 1);
});

test("storage failures reject login instead of reporting a successful session", async () => {
  const session = createAuthSession({
    ...storage(),
    setItem() { throw new Error("Storage unavailable"); },
  });
  await assert.rejects(
    session.login(credentials, async () => ({ accessToken: "issued-token" })),
    /Storage unavailable/,
  );
  assert.equal(session.getAccessToken(), null);
});
