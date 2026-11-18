import { useEffect, useState } from "react";
import type { ActivityApi } from "./api";
import { categories, dateText, pageTypes } from "./types";
import type { Book, BookInput, Category, PageType, Sort } from "./types";
import {
  Calendar,
  Confirm,
  ErrorMessage,
  Failure,
  Icon,
  IconButton,
  Loading,
} from "./ui";

export function Bookshelf({
  api,
  onCreate,
  onBook,
  onNavigate,
}: {
  api: ActivityApi;
  onCreate: () => void;
  onBook: (id: number) => void;
  onNavigate?: (destination: "roadmap" | "connections" | "settings") => void;
}) {
  const [books, setBooks] = useState<Book[] | null>(null),
    [sort, setSort] = useState<Sort>("LATEST"),
    [menu, setMenu] = useState(false),
    [error, setError] = useState<unknown>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    api
      .books(sort, c.signal)
      .then((data) => {
        setBooks(data);
        setError(null);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      });
    return () => c.abort();
  }, [api, sort, revision]);
  const cells = books ? [...books, null] : [];
  const rowCount = Math.max(3, Math.ceil(cells.length / 3));
  return (
    <section className="screen shelf-screen">
      <header className="shelf-header">
        <p className="eyebrow">MY EXPERIENCE LIBRARY</p>
        <div className="shelf-title">
          <h1>나의 책장</h1>
          <IconButton
            name="settings"
            label="설정"
            disabled={!onNavigate}
            onClick={() => onNavigate?.("settings")}
          />
        </div>
        <div className="shelf-subtitle">
          <p>경험을 한 권씩, 나답게 쌓아가요.</p>
          <button
            className="sort-toggle"
            aria-label="책장 정렬"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Icon name="down" />
          </button>
        </div>
        {menu && (
          <>
            <button
              className="menu-dismiss"
              aria-label="정렬 닫기"
              onClick={() => setMenu(false)}
            />
            <div className="sort-menu" role="group" aria-label="정렬 기준">
              {(
                [
                  ["LATEST", "최신순"],
                  ["OLDEST", "오래된 순"],
                  ["CATEGORY", "항목 순"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={sort === value}
                  className={sort === value ? "active" : ""}
                  onClick={() => {
                    setSort(value);
                    setMenu(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </header>
      {error ? (
        <Failure error={error} retry={() => setRevision((r) => r + 1)} />
      ) : !books ? (
        <Loading />
      ) : (
        <>
          <div className="shelves">
            {Array.from({ length: rowCount }, (_, row) => (
              <div className="shelf-row" key={row}>
                {cells.slice(row * 3, row * 3 + 3).map((book, col) =>
                  book ? (
                    <button
                      className={`book-cover ${book.coverColor?.toLowerCase() || "cream"}`}
                      key={book.bookId}
                      onClick={() => onBook(book.bookId)}
                    >
                      <span className="book-name">{book.title}</span>
                      <span className="book-caption">
                        {categories[book.category]}
                        <br />
                        <span>{dateText(book.startDate).slice(0, 7)}</span>
                      </span>
                    </button>
                  ) : (
                    <button
                      className="book-add"
                      key={`add-${col}`}
                      onClick={onCreate}
                    >
                      <Icon name="addBook" />
                      <span>기록 추가</span>
                    </button>
                  ),
                )}
              </div>
            ))}
          </div>
          <div className="shelf-dot">
            <Icon name="shelfDot" />
          </div>
          <p className="shelf-count">
            {books.length
              ? `${books.length}권의 경험이 쌓였어요`
              : "아직 경험이 쌓이지 않았어요"}
          </p>
        </>
      )}
      <nav className="bottom-nav" aria-label="주 메뉴">
        <button disabled={!onNavigate} onClick={() => onNavigate?.("roadmap")}>
          <Icon name="roadmap" />
          로드맵
        </button>
        <button aria-current="page">
          <Icon name="activity" />
          활동
        </button>
        <button
          disabled={!onNavigate}
          onClick={() => onNavigate?.("connections")}
        >
          <Icon name="connection" />
          경험 연결
        </button>
      </nav>
    </section>
  );
}

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
