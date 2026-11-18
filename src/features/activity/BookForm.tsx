import { useState } from "react";
import type { ActivityApi } from "./api";
import { categories, dateText, pageTypes } from "./types";
import type { Book, BookInput, Category, PageType } from "./types";
import { Calendar, Confirm, ErrorMessage, Icon, IconButton } from "./ui";

export function BookForm({
  api,
  book,
  onBack,
  onCreated,
  onSaved,
  onDeleted,
}: {
  api: ActivityApi;
  book?: Book;
  onBack: () => void;
  onCreated: (pageId: number) => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(book?.title || ""),
    [start, setStart] = useState(book?.startDate || ""),
    [end, setEnd] = useState(book?.endDate || null),
    [category, setCategory] = useState<Category | "">(book?.category || ""),
    [type, setType] = useState<PageType | "">("");
  const [calendar, setCalendar] = useState<"start" | "end" | null>(null),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  async function save() {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "책 이름을 입력해 주세요.";
    else if (Array.from(title).length > 12)
      next.title = "책 이름은 공백 포함 12자까지 입력할 수 있어요.";
    if (!start) next.start = "시작일을 선택해 주세요.";
    if (end && end < start)
      next.start = "종료일은 시작일 이후로 선택해 주세요.";
    if (!category) next.category = "카테고리를 선택해 주세요.";
    if (!book && !type) next.type = "속지 유형을 선택해 주세요.";
    setErrors(next);
    if (Object.keys(next).length || !category) return;
    setBusy(true);
    setError(null);
    const input: BookInput = {
      title,
      startDate: start,
      endDate: end,
      category,
    };
    try {
      if (book) {
        await api.updateBook(book.bookId, input);
        onSaved();
      } else if (type) {
        const result = await api.createBook({ ...input, firstPageType: type });
        onCreated(result.firstPageId);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!book) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteBook(book.bookId);
      onDeleted();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="screen form-screen">
      <header className="form-header">
        <IconButton name="back" label="뒤로" onClick={onBack} />
        <h1>{book ? "책 정보 수정" : "새 책 만들기"}</h1>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        <div className="book-form-fields">
          <div className="field">
            <div className="field-title">
              <label htmlFor="book-title">책 이름</label>
              <small>{Array.from(title).length}/12</small>
            </div>
            <input
              id="book-title"
              value={title}
              placeholder="책 이름을 입력해주세요"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "title-error" : undefined}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((v) => ({ ...v, title: "" }));
              }}
            />
            <div id="title-error">
              <ErrorMessage error={errors.title} />
            </div>
          </div>
          <div className="field">
            <h2>활동 날짜</h2>
            <div className="date-controls">
              {(["start", "end"] as const).map((field) => (
                <button
                  type="button"
                  className="date-control"
                  key={field}
                  onClick={() => setCalendar(field)}
                >
                  <Icon name="calendar" />
                  <span>
                    <small>{field === "start" ? "시작일" : "종료일"}</small>
                    {(field === "start" ? start : end)
                      ? dateText(field === "start" ? start : end)
                      : "날짜 선택"}
                  </span>
                </button>
              ))}
            </div>
            <ErrorMessage error={errors.start} />
          </div>
          <div className="field">
            <h2>카테고리</h2>
            <div className="categories">
              {(Object.entries(categories) as [Category, string][]).map(
                ([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={category === value}
                    className={category === value ? "selected" : ""}
                    onClick={() => {
                      setCategory(value);
                      setErrors((v) => ({ ...v, category: "" }));
                    }}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
            {category === "ETC" && (
              <p className="hint with-icon">
                <Icon name="info" />
                기타 활동은 로드맵에 반영되지 않아요.
              </p>
            )}
            <ErrorMessage error={errors.category} />
          </div>
          {!book && (
            <div className="field">
              <h2>속지</h2>
              <div className="page-type-options">
                {(
                  Object.entries(pageTypes) as [
                    PageType,
                    typeof pageTypes.ACTIVITY,
                  ][]
                ).map(([value, info]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={type === value}
                    onClick={() => {
                      setType(value);
                      setErrors((v) => ({ ...v, type: "" }));
                    }}
                  >
                    <span>{info.label}</span>
                    <small>{info.description}</small>
                    {type === value && <Icon name="check" />}
                  </button>
                ))}
              </div>
              <ErrorMessage error={errors.type} />
            </div>
          )}
          {book && (
            <div className="delete-book">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setDeleting(true);
                }}
              >
                책 전체 삭제
              </button>
              <p className="hint">
                이 책을 삭제하면 안에 있는 모든 속지도 함께 삭제돼요.
              </p>
            </div>
          )}
          {!deleting && <ErrorMessage error={error} />}
        </div>
        <footer className="fixed-action">
          <button className="primary" disabled={busy} type="submit">
            {busy ? "저장 중…" : book ? "수정 완료" : "책 만들기"}
          </button>
        </footer>
      </form>
      {calendar && (
        <Calendar
          startDate={start}
          endDate={end}
          initialField={calendar}
          onClose={() => setCalendar(null)}
          onApply={(s, e) => {
            setStart(s);
            setEnd(e);
            setCalendar(null);
            setErrors((v) => ({ ...v, start: "" }));
          }}
        />
      )}
      {deleting && (
        <Confirm
          title="책 전체를 삭제할까요?"
          description="이 책과 책 안의 모든 속지가 함께 삭제돼요."
          busy={busy}
          error={error}
          onCancel={() => setDeleting(false)}
          onConfirm={() => void remove()}
        />
      )}
    </section>
  );
}
