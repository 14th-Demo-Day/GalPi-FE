import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ActivityApi } from "../activity/api";
import type { Book } from "../activity/types";
import { dateText } from "../activity/types";
import { BottomNav } from "../activity/BottomNav";
import { Failure, Icon, IconButton, Loading, Modal } from "../activity/ui";
import {
  booksInQuarter,
  booksInYear,
  currentQuarter,
  isOngoing,
  layoutBars,
  listPeriod,
  quarterMonths,
  quarters,
  roadmapRows,
  searchBooks,
  todayString,
  yearOptions,
} from "./roadmap";
import type { Quarter } from "./roadmap";
import "../activity/activity.css";
import "./roadmap.css";

type Tab = "roadmap" | "activity" | "connections";
const PAGE_SIZE = 5;

// Built from the activity book list; swap in a roadmap endpoint if the backend adds one.
export function RoadmapScreen({
  api,
  view,
  onToggleView,
  onOpenBook,
  onCreateBook,
  onNavigate,
}: {
  api: ActivityApi;
  view: "annual" | "quarterly";
  onToggleView: () => void;
  onOpenBook: (bookId: number) => void;
  onCreateBook: () => void;
  onNavigate?: (tab: Tab) => void;
}) {
  const today = todayString();
  const thisYear = new Date().getFullYear();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [year, setYear] = useState(thisYear);
  const [quarter, setQuarter] = useState<Quarter>(currentQuarter());
  const [selected, setSelected] = useState<Book | null>(null);

  useEffect(() => {
    const c = new AbortController();
    api
      .books("OLDEST", c.signal)
      .then((data) => {
        setBooks(data);
        setError(null);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      });
    return () => c.abort();
  }, [api, revision]);

  return (
    <section className="screen roadmap-screen">
      <header className="roadmap-header">
        <h1 className="roadmap-title">나의 로드맵</h1>
        <YearPicker
          year={year}
          options={yearOptions(books ?? [], thisYear)}
          onChange={setYear}
        />
        <div className="roadmap-subtitle">
          <p>한 해의 경험을 한눈에</p>
          <button type="button" onClick={onToggleView}>
            {view === "annual" ? "분기별 보기" : "연간 로드맵"}
          </button>
        </div>
      </header>

      {error ? (
        <Failure error={error} retry={() => setRevision((r) => r + 1)} />
      ) : !books ? (
        <Loading />
      ) : view === "annual" ? (
        <AnnualView
          books={books}
          year={year}
          today={today}
          highlight={year === thisYear ? currentQuarter() : null}
          onSelect={setSelected}
          onCreateBook={onCreateBook}
        />
      ) : (
        <QuarterlyView
          books={books}
          year={year}
          quarter={quarter}
          today={today}
          onQuarter={setQuarter}
          onSelect={setSelected}
        />
      )}

      {selected && (
        <BookSheet
          api={api}
          book={selected}
          today={today}
          onClose={() => setSelected(null)}
          onOpen={() => onOpenBook(selected.bookId)}
        />
      )}

      <BottomNav
        activeTab="roadmap"
        onNavigate={
          onNavigate &&
          ((tab) => {
            if (tab !== "roadmap") onNavigate(tab);
          })
        }
      />
    </section>
  );
}

function YearPicker({
  year,
  options,
  onChange,
}: {
  year: number;
  options: number[];
  onChange: (year: number) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="year-picker">
      <button
        type="button"
        className="year-toggle"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${year}년, 연도 선택`}
        onClick={() => setOpen(!open)}
      >
        <span>{year}</span>
        <Icon name="down" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="menu-dismiss"
            aria-label="연도 선택 닫기"
            onClick={() => setOpen(false)}
          />
          <div className="year-menu" role="group" aria-label="연도">
            {options.map((y) => (
              <button
                type="button"
                key={y}
                aria-pressed={y === year}
                className={y === year ? "active" : ""}
                onClick={() => {
                  onChange(y);
                  setOpen(false);
                }}
              >
                {y}년
                {y === year && <Icon name="check" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AnnualView({
  books,
  year,
  today,
  highlight,
  onSelect,
  onCreateBook,
}: {
  books: Book[];
  year: number;
  today: string;
  highlight: Quarter | null;
  onSelect: (book: Book) => void;
  onCreateBook: () => void;
}) {
  const inYear = booksInYear(books, year, today);
  const rows = roadmapRows.filter(
    (r) => r.category !== "ETC" || inYear.some((b) => b.category === "ETC"),
  );
  return (
    <>
      <div className="roadmap-grid" role="table" aria-label={`${year}년 로드맵`}>
        <div className="grid-row grid-head" role="row">
          <div className="grid-label" role="columnheader">
            활동
          </div>
          {quarters.map((q) => (
            <div
              key={q}
              role="columnheader"
              className={`grid-quarter ${q === highlight ? "current" : ""}`}
            >
              <strong>{q}분기</strong>
              <small>{quarterMonths[q]}</small>
            </div>
          ))}
        </div>
        {rows.map(({ category, label }) => {
          const { bars, lanes } = layoutBars(
            inYear.filter((b) => b.category === category),
            year,
            today,
          );
          return (
            <div className="grid-row" role="row" key={category}>
              <div className="grid-label" role="rowheader">
                {label}
              </div>
              {quarters.map((q) => (
                <div key={q} className="grid-cell" aria-hidden="true" />
              ))}
              <div
                className="grid-bars"
                role="cell"
                style={{ "--lanes": Math.max(lanes, 1) } as CSSProperties}
              >
                {bars.map(({ book, left, width, lane }) => (
                  <button
                    type="button"
                    key={book.bookId}
                    className="roadmap-bar"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      top: `calc(${lane} * (var(--bar-height) + var(--bar-gap)))`,
                    }}
                    title={book.title}
                    onClick={() => onSelect(book)}
                  >
                    {book.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {!inYear.length && (
        <div className="roadmap-empty">
          <h2>
            {books.length
              ? `${year}년에 쌓인 활동이 없어요`
              : "아직 쌓인 활동이 없어요"}
          </h2>
          <p>
            첫 책을 만들면 활동 기간과 분야에 따라
            <br />
            로드맵이 자동으로 채워져요.
          </p>
          <button type="button" className="primary tall" onClick={onCreateBook}>
            {books.length ? "새 책 만들기" : "첫 책 만들기"}
          </button>
        </div>
      )}
    </>
  );
}

function QuarterlyView({
  books,
  year,
  quarter,
  today,
  onQuarter,
  onSelect,
}: {
  books: Book[];
  year: number;
  quarter: Quarter;
  today: string;
  onQuarter: (q: Quarter) => void;
  onSelect: (book: Book) => void;
}) {
  const [query, setQuery] = useState("");
  // "More" paging restarts whenever the year, quarter or search changes.
  const scope = `${year}-${quarter}-${query.trim()}`;
  const [paging, setPaging] = useState({ scope, count: PAGE_SIZE });
  const visible = paging.scope === scope ? paging.count : PAGE_SIZE;
  const inQuarter = useMemo(
    () => booksInQuarter(books, year, quarter, today),
    [books, year, quarter, today],
  );
  const results = searchBooks(inQuarter, query);
  const shown = results.slice(0, visible);
  const more = Math.min(PAGE_SIZE, results.length - shown.length);
  return (
    <>
      <div className="quarter-tabs" role="group" aria-label="분기 선택">
        {quarters.map((q) => (
          <button
            type="button"
            key={q}
            aria-pressed={q === quarter}
            className={q === quarter ? "active" : ""}
            onClick={() => onQuarter(q)}
          >
            {q}분기
          </button>
        ))}
      </div>
      <div className="roadmap-search">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </svg>
        <input
          type="search"
          aria-label="기록 검색"
          placeholder="기록 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <IconButton
            name="close"
            label="검색어 지우기"
            onClick={() => setQuery("")}
          />
        )}
      </div>
      <div className="quarter-list">
        <div className="quarter-list-head" aria-hidden="true">
          <span>책 이름</span>
          <span>활동 기간</span>
        </div>
        {results.length ? (
          <ul>
            {shown.map((book) => {
              const { text, note } = listPeriod(book, year);
              return (
                <li key={book.bookId}>
                  <button type="button" onClick={() => onSelect(book)}>
                    <span className="quarter-book">{book.title}</span>
                    <span className="quarter-period">
                      {text}
                      {note && <small>{note}</small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="roadmap-empty compact">
            {query.trim() ? (
              <>
                <h2>검색 결과가 없어요</h2>
                <p>
                  책 이름을 확인하거나
                  <br />
                  다른 분기에서 찾아보세요.
                </p>
              </>
            ) : (
              <>
                <h2>이 분기에 쌓인 활동이 없어요</h2>
                <p>다른 분기를 선택해보세요.</p>
              </>
            )}
          </div>
        )}
        {more > 0 && (
          <button
            type="button"
            className="quarter-more"
            onClick={() => setPaging({ scope, count: visible + PAGE_SIZE })}
          >
            {more}권 더 보기 · {shown.length}/{results.length}
          </button>
        )}
      </div>
    </>
  );
}

function BookSheet({
  api,
  book,
  today,
  onClose,
  onOpen,
}: {
  api: ActivityApi;
  book: Book;
  today: string;
  onClose: () => void;
  onOpen: () => void;
}) {
  const [pageCount, setPageCount] = useState(book.pageCount);
  useEffect(() => {
    if (book.pageCount !== undefined) return;
    const c = new AbortController();
    api
      .book(book.bookId, c.signal)
      .then((b) => setPageCount(b.pageCount))
      .catch(() => {});
    return () => c.abort();
  }, [api, book]);
  return (
    <Modal title={`선택한 책: ${book.title}`} onClose={onClose} sheet className="roadmap-sheet">
      <div className="sheet-handle" />
      <div className="roadmap-sheet-close">
        <IconButton name="close" label="닫기" onClick={onClose} />
      </div>
      <small className="roadmap-sheet-eyebrow">선택한 책</small>
      <div className="roadmap-sheet-title">
        <h2>{book.title}</h2>
        {isOngoing(book, today) && <span className="ongoing">진행 중</span>}
      </div>
      <dl className="roadmap-sheet-info">
        <div>
          <dt>활동 기간</dt>
          <dd>
            {dateText(book.startDate)} ~{" "}
            {book.endDate ? dateText(book.endDate) : "진행 중"}
          </dd>
        </div>
        <div>
          <dt>기록지</dt>
          <dd>{pageCount === undefined ? "—" : `${pageCount}장`}</dd>
        </div>
      </dl>
      <button type="button" className="primary tall" onClick={onOpen}>
        책 속 기록 보기 →
      </button>
    </Modal>
  );
}
