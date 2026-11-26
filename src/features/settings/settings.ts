import { ApiError } from "../activity/api.ts";
import type { ActivityApi } from "../activity/api";

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

// PATCH /api/users/me/password (4.1.2) error codes → the field to mark.
export const PASSWORD_ERROR_FIELDS: Record<string, keyof PasswordInput> = {
  WRONG_CURRENT_PASSWORD: "current",
  INVALID_INPUT: "current",
  INVALID_PASSWORD_FORMAT: "next",
  PASSWORD_CONFIRM_MISMATCH: "confirm",
};
const PASSWORD_ERROR_TEXT: Record<string, string> = {
  WRONG_CURRENT_PASSWORD: "현재 비밀번호가 맞지 않아요. 다시 확인해주세요.",
  INVALID_INPUT: "현재 비밀번호를 입력해주세요.",
  INVALID_PASSWORD_FORMAT: PASSWORD_RULE,
  PASSWORD_CONFIRM_MISMATCH: "새 비밀번호와 일치하지 않아요. 다시 입력해주세요.",
};

// Turns a server error into a field message, or null for a general failure.
export function passwordFieldError(
  e: unknown,
): PasswordErrors | null {
  if (!(e instanceof ApiError)) return null;
  const field = PASSWORD_ERROR_FIELDS[e.code];
  return field ? { [field]: PASSWORD_ERROR_TEXT[e.code] } : null;
}

// GET /api/users/me (4.1) response (data).
export interface Me {
  userId: number;
  loginId: string;
  // true when there is at least one book or saved sentence.
  hasRecords: boolean;
}

export interface SettingsApi {
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
    newPasswordConfirm: string;
  }) => Promise<void>;
  me: (signal?: AbortSignal) => Promise<Me>;
  resetRecords: () => Promise<void>;
  logout: () => Promise<void>;
}

// me: GET /api/users/me (4.1).
// changePassword: PATCH /api/users/me/password (4.1.2).
// resetRecords: DELETE /api/users/me/records (4.2.1) — books, pages,
// attachments and saved sentences; the account stays.
// logout: POST /api/auth/logout (4.3.1); the caller then deletes the token.
export function createSettingsApi(
  activity: Pick<ActivityApi, "request">,
): SettingsApi {
  return {
    async changePassword(input) {
      await activity.request<null>("/api/users/me/password", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    me: (signal) => activity.request<Me>("/api/users/me", { signal }),
    async logout() {
      await activity.request<null>("/api/auth/logout", { method: "POST" });
    },
    async resetRecords() {
      await activity.request<null>("/api/users/me/records", {
        method: "DELETE",
      });
    },
  };
}
