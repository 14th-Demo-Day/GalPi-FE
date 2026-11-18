import test from "node:test";
import assert from "node:assert/strict";
import { createAuthApi } from "../src/features/onboarding/api.ts";

const credentials = { loginId: "reader", password: "test-only" };

test("signup sends the verified request without requiring an existing token", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.example.test/api/auth/signup");
    assert.equal(init.method, "POST");
    assert.equal(new Headers(init.headers).get("Content-Type"), "application/json");
    assert.equal(new Headers(init.headers).has("Authorization"), false);
    assert.deepEqual(JSON.parse(init.body), credentials);
    return Response.json({ success: true, data: { userId: 1 } }, { status: 201 });
  });
  assert.deepEqual(await createAuthApi("https://api.example.test").signup(credentials), { userId: 1 });
});

test("incorrect credentials preserve the backend error and do not report success", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    success: false, code: "LOGIN_FAILED", message: "아이디 또는 비밀번호를 확인해주세요.",
  }, { status: 401 }));
  await assert.rejects(createAuthApi("https://api.example.test").login(credentials),
    (e) => e.status === 401 && e.code === "LOGIN_FAILED" && e.message === "아이디 또는 비밀번호를 확인해주세요.");
});

test("gateway HTML, invalid success responses and transport failures have usable errors", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("<h1>Bad Gateway</h1>", { status: 502 }));
  const api = createAuthApi("https://api.example.test");
  await assert.rejects(api.login(credentials), (e) => e.status === 502 && e.code === "REQUEST_FAILED");
  fetch.mock.mockImplementation(async () => Response.json({ accessToken: "unexpected-shape" }));
  await assert.rejects(api.login(credentials), (e) => e.code === "INVALID_RESPONSE");
  fetch.mock.mockImplementation(async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(api.login(credentials), (e) => e.code === "NETWORK_ERROR");
});

test("missing backend configuration does not send credentials", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("unexpected request"); });
  await assert.rejects(createAuthApi("").login(credentials), (e) => e.code === "API_NOT_CONFIGURED");
  assert.equal(fetch.mock.callCount(), 0);
});
