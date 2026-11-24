import { ApiError } from "../activity/api.ts";
import type { ActivityApi } from "../activity/api";
import type { ConnectionApi } from "../connection/api";

export interface PasswordInput {
  current: string;
  next: string;
  confirm: string;
}
export type PasswordErrors = Partial<Record<keyof PasswordInput, string>>;

export const PASSWORD_RULE =
  "영문, 숫자, 특수문자 중 2가지 이상을 포함한 5~20자여야 합니다";

// Two or more of: letters, digits, other printable symbols; 5–20 characters.
export function isValidPassword(password: string) {
  if (password.length < 5 || password.length > 20 || /\s/.test(password))
    return false;
  const kinds = [/[A-Za-z]/, /\d/, /[^A-Za-z\d]/].filter((r) =>
    r.test(password),
  ).length;
  return kinds >= 2;
}

export function validatePassword({ current, next, confirm }: PasswordInput) {
  const errors: PasswordErrors = {};
  if (!current) errors.current = "현재 비밀번호를 입력해주세요.";
  if (!next) errors.next = "새 비밀번호를 입력해주세요.";
  else if (!isValidPassword(next)) errors.next = PASSWORD_RULE;
  if (!confirm) errors.confirm = "새 비밀번호를 한 번 더 입력해주세요.";
  else if (next && confirm !== next)
    errors.confirm = "새 비밀번호와 일치하지 않아요. 다시 입력해주세요.";
  return errors;
}

export const WRONG_PASSWORD = "INVALID_PASSWORD";

export interface SettingsApi {
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<void>;
  hasRecords: (signal?: AbortSignal) => Promise<boolean>;
  resetRecords: () => Promise<void>;
}

// Record reset uses the existing activity/connection APIs. There is no password
// endpoint yet, so changePassword is a stand-in that always succeeds; it must
// reject with ApiError code WRONG_PASSWORD when the current password is wrong.
// Dev only: add ?settings=wrong-password to see that error.
export function createSettingsApi(
  activity: Pick<ActivityApi, "books" | "deleteBook">,
  connection: Pick<ConnectionApi, "saved" | "clear">,
): SettingsApi {
  return {
    async changePassword() {
      await new Promise((r) => setTimeout(r, 500));
      if (
        import.meta.env?.DEV &&
        new URLSearchParams(location.search).get("settings") ===
          "wrong-password"
      )
        throw new ApiError(
          "현재 비밀번호가 맞지 않아요. 다시 확인해주세요.",
          WRONG_PASSWORD,
          400,
        );
    },
    async hasRecords(signal) {
      const [books, saved] = await Promise.all([
        activity.books("LATEST", signal),
        connection.saved(signal),
      ]);
      return books.length > 0 || saved.length > 0;
    },
    async resetRecords() {
      // Deleting a book removes its pages and attachments on the server.
      const books = await activity.books("LATEST");
      for (const book of books) await activity.deleteBook(book.bookId);
      await connection.clear();
    },
  };
}
