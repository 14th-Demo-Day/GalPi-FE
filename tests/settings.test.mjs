import test from "node:test";
import assert from "node:assert/strict";
import {
  createSettingsApi,
  isValidPassword,
  PASSWORD_RULE,
  passwordFieldError,
  validatePassword,
} from "../src/features/settings/settings.ts";
import { ApiError } from "../src/features/activity/api.ts";
import { createAuthSession } from "../src/features/onboarding/session.ts";

test("password needs 5–20 characters with two kinds of letters, digits, symbols", () => {
  assert.equal(isValidPassword("abc12"), true);
  assert.equal(isValidPassword("abc!!"), true);
  assert.equal(isValidPassword("12#$5"), true);
  assert.equal(isValidPassword("abcdef"), false);
  assert.equal(isValidPassword("123456"), false);
  assert.equal(isValidPassword("ab1"), false);
  assert.equal(isValidPassword("a1".repeat(10) + "x"), false);
  assert.equal(isValidPassword("abc 12"), false);
});

test("validation messages match the Figma error states", () => {
  assert.deepEqual(validatePassword({ current: "", next: "", confirm: "" }), {
    current: "현재 비밀번호를 입력해주세요.",
    next: "새 비밀번호를 입력해주세요.",
    confirm: "새 비밀번호를 한 번 더 입력해주세요.",
  });
  assert.deepEqual(validatePassword({ current: "x", next: "abcdef", confirm: "abcdef" }), {
    next: PASSWORD_RULE,
  });
  assert.deepEqual(validatePassword({ current: "x", next: "abc12", confirm: "abc13" }), {
    confirm: "새 비밀번호와 일치하지 않아요. 다시 입력해주세요.",
  });
  assert.deepEqual(validatePassword({ current: "x", next: "abc12", confirm: "abc12" }), {});
});

test("me and record reset call the user endpoints", async () => {
  const calls = [];
  let hasRecords = true;
  const api = createSettingsApi({
    request: async (path, init = {}) => {
      calls.push(`${init.method ?? "GET"} ${path}`);
      if (path === "/api/users/me/records") {
        hasRecords = false;
        return null;
      }
      return { userId: 1, loginId: "galpi01", hasRecords };
    },
  });
  assert.deepEqual(await api.me(), { userId: 1, loginId: "galpi01", hasRecords: true });
  await api.resetRecords();
  assert.equal((await api.me()).hasRecords, false);
  assert.deepEqual(calls, ["GET /api/users/me", "DELETE /api/users/me/records", "GET /api/users/me"]);
});

test("session keeps the login id until logout", () => {
  const data = new Map();
  const session = createAuthSession({
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  });
  session.rememberLoginId("rkfvl");
  assert.equal(session.getLoginId(), "rkfvl");
  session.clear();
  assert.equal(session.getLoginId(), null);
});

test("password change sends PATCH with all three fields", async () => {
  const calls = [];
  const api = createSettingsApi(
    { request: async (path, init) => { calls.push({ path, method: init.method, body: JSON.parse(init.body) }); return null; } },
  );
  await api.changePassword({ currentPassword: "pass1234!", newPassword: "newpass5678@", newPasswordConfirm: "newpass5678@" });
  assert.deepEqual(calls, [{
    path: "/api/users/me/password",
    method: "PATCH",
    body: { currentPassword: "pass1234!", newPassword: "newpass5678@", newPasswordConfirm: "newpass5678@" },
  }]);
});

test("server password errors land on the matching field", () => {
  assert.deepEqual(passwordFieldError(new ApiError("x", "WRONG_CURRENT_PASSWORD", 400)), {
    current: "현재 비밀번호가 맞지 않아요. 다시 확인해주세요.",
  });
  assert.deepEqual(passwordFieldError(new ApiError("x", "INVALID_INPUT", 400)), { current: "현재 비밀번호를 입력해주세요." });
  assert.deepEqual(passwordFieldError(new ApiError("x", "INVALID_PASSWORD_FORMAT", 400)), { next: PASSWORD_RULE });
  assert.deepEqual(passwordFieldError(new ApiError("x", "PASSWORD_CONFIRM_MISMATCH", 400)), {
    confirm: "새 비밀번호와 일치하지 않아요. 다시 입력해주세요.",
  });
  assert.equal(passwordFieldError(new ApiError("x", "NETWORK_ERROR", 0)), null);
  assert.equal(passwordFieldError(new Error("x")), null);
});

test("logout posts to /api/auth/logout", async () => {
  const calls = [];
  const api = createSettingsApi({
    request: async (path, init) => {
      calls.push(`${init.method} ${path}`);
      return null;
    },
  });
  await api.logout();
  assert.deepEqual(calls, ["POST /api/auth/logout"]);
});
