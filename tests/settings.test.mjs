import test from "node:test";
import assert from "node:assert/strict";
import {
  createSettingsApi,
  isValidPassword,
  PASSWORD_RULE,
  validatePassword,
} from "../src/features/settings/settings.ts";
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

test("reset deletes every book and saved sentence", async () => {
  let books = [{ bookId: 1 }, { bookId: 2 }];
  let saved = [{ id: 1 }];
  const api = createSettingsApi(
    {
      books: async () => books,
      deleteBook: async (id) => {
        books = books.filter((b) => b.bookId !== id);
      },
    },
    {
      saved: async () => ({ totalCount: saved.length, page: 0, hasNext: false, items: saved }),
      clear: async () => {
        saved = [];
      },
    },
  );
  assert.equal(await api.hasRecords(), true);
  await api.resetRecords();
  assert.deepEqual(books, []);
  assert.deepEqual(saved, []);
  assert.equal(await api.hasRecords(), false);
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
