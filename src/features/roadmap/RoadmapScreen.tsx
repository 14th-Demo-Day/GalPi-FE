import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ApiError } from "../activity/api";
import type { ActivityApi } from "../activity/api";
import type { Book } from "../activity/types";
import { dateText } from "../activity/types";
import { BottomNav } from "../activity/BottomNav";
import {
  ErrorMessage,
  Failure,
  Icon,
  IconButton,
  Loading,
  Modal,
} from "../activity/ui";
import {
  currentQuarter,
  isOngoing,
  listPeriod,
  placeBars,
  quarterMonths,
  quarters,
  roadmapRows,
  todayString,
  buildYears,
} from "./roadmap";
import type {
  Quarter,
  QuarterBook,
  RoadmapBookDetail,
  RoadmapData,
  RoadmapYears,
} from "./roadmap";
import "../activity/activity.css";
import "./roadmap.css";

type Tab = "roadmap" | "activity" | "connections";
const PAGE_SIZE = 5;

// Annual: GET /api/roadmap?year=. Quarterly: GET /api/roadmap/quarter.
// Years: GET /api/roadmap/years. Detail: GET /api/roadmap/books/{id}.
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
  const [year, setYear] = useState(thisYear);
  const [quarter, setQuarter] = useState<Quarter>(currentQuarter());
  const [selected, setSelected] = useState<Book | null>(null);
  const [years, setYears] = useState<RoadmapYears | null>(null);

  useEffect(() => {
    const c = new AbortController();
    api
      .request<RoadmapYears>("/api/roadmap/years", { signal: c.signal })
      .then((d) => {
        if (!c.signal.aborted) setYears(d);
      })
      // On failure the picker falls back to a locally built year range.
      .catch(() => {});
    return () => c.abort();
  }, [api]);

  return (
    <section className="screen roadmap-screen">
      <header className="roadmap-header">
        <h1 className="roadmap-title">나의 로드맵</h1>
        <YearPicker
          year={year}
          options={(years ?? buildYears([], thisYear, today)).years}
          onChange={setYear}
        />
        <div className="roadmap-subtitle">
          <p>한 해의 경험을 한눈에</p>
          <button type="button" onClick={onToggleView}>
            {view === "annual" ? "분기별 보기" : "연간 로드맵"}
          </button>
        </div>
      </header>

      {view === "annual" ? (
        <AnnualView
          key={year}
          api={api}
          year={year}
          highlight={year === thisYear ? currentQuarter() : null}
          onSelect={setSelected}
          onCreateBook={onCreateBook}
        />
      ) : (
        <QuarterlyView
          api={api}
          year={year}
          quarter={quarter}
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
  options: RoadmapYears["years"];
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
            {options.map(({ year: y, hasRecord }) => (
              <button
                type="button"
                key={y}
                aria-pressed={y === year}
                className={y === year ? "active" : ""}
                ref={y === year ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                onClick={() => {
                  onChange(y);
                  setOpen(false);
                }}
              >
                <span className="year-label">
                  {y}년
                  {hasRecord && (
                    <span className="year-record">
                      <span className="sr-only">, 기록 있음</span>
                    </span>
                  )}
                </span>
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
  api,
  year,
  highlight,
  onSelect,
  onCreateBook,
}: {
  api: ActivityApi;
  year: number;
  highlight: Quarter | null;
  onSelect: (book: Book) => void;
  onCreateBook: () => void;
}) {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    api
      .request<RoadmapData>(`/api/roadmap?year=${year}`, { signal: c.signal })
      .then((d) => {
        if (!c.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      });
    return () => c.abort();
  }, [api, year, revision]);

  if (error)
    return (
      <Failure
        error={error}
        retry={() => {
          setError(null);
          setRevision((r) => r + 1);
        }}
      />
    );
  if (!data) return <Loading />;

  const empty = data.rows.every((r) => !r.bars.length);
  const label = (category: Book["category"]) =>
    roadmapRows.find((r) => r.category === category)?.label ?? category;
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
        {data.rows.map((row) => (
          <div className="grid-row" role="row" key={row.category}>
            <div className="grid-label" role="rowheader">
              {label(row.category)}
            </div>
            {quarters.map((q) => (
              <div key={q} className="grid-cell" aria-hidden="true" />
            ))}
            <div
              className="grid-bars"
              role="cell"
              style={{ "--lanes": Math.max(row.laneCount, 1) } as CSSProperties}
            >
              {placeBars(row, year).map(({ bar, left, width }) => (
                <button
                  type="button"
                  key={bar.bookId}
                  className="roadmap-bar"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    top: `calc(${bar.lane} * (var(--bar-height) + var(--bar-gap)))`,
                  }}
                  title={bar.title}
                  onClick={() =>
                    onSelect({
                      bookId: bar.bookId,
                      title: bar.title,
                      startDate: bar.startDate,
                      endDate: bar.endDate,
                      category: row.category,
                    })
                  }
                >
                  {bar.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {empty && (
        <div className="roadmap-empty">
          <h2>아직 쌓인 활동이 없어요</h2>
          <p>
            첫 책을 만들면 활동 기간과 분야에 따라
            <br />
            로드맵이 자동으로 채워져요.
          </p>
          <button type="button" className="primary tall" onClick={onCreateBook}>
            첫 책 만들기
          </button>
        </div>
      )}
    </>
  );
}

const SEARCH_DELAY = 300;

function QuarterlyView({
  api,
  year,
  quarter,
  onQuarter,
  onSelect,
}: {
  api: ActivityApi;
  year: number;
  quarter: Quarter;
  onQuarter: (q: Quarter) => void;
  onSelect: (book: Book) => void;
}) {
  const [query, setQuery] = useState("");
  // The keyword sent to the server, updated after typing pauses.
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<{
    key: string;
    keyword: string;
    books: QuarterBook[];
  } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const key = `${year}-${quarter}-${keyword}`;

  useEffect(() => {
    const t = setTimeout(() => setKeyword(query.trim()), SEARCH_DELAY);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const c = new AbortController();
    const params = new URLSearchParams({
      year: String(year),
      quarter: String(quarter),
    });
    if (keyword) params.set("keyword", keyword);
    api
      .request<QuarterBook[]>(`/api/roadmap/quarter?${params}`, {
        signal: c.signal,
      })
      .then((books) => {
        if (c.signal.aborted) return;
        setResult({ key: `${year}-${quarter}-${keyword}`, keyword, books });
        setError(null);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      });
    return () => c.abort();
  }, [api, year, quarter, keyword, revision]);

  // "More" paging restarts whenever the year, quarter or keyword changes.
  const [paging, setPaging] = useState({ key, count: PAGE_SIZE });
  const visible = paging.key === key ? paging.count : PAGE_SIZE;
  // The previous list stays visible while the next one loads, to avoid flicker.
  const books = result?.books ?? [];
  const shown = books.slice(0, visible);
  const more = Math.min(PAGE_SIZE, books.length - shown.length);

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
          onKeyDown={(e) => {
            if (e.key === "Enter") setKeyword(query.trim());
          }}
        />
        {query && (
          <IconButton
            name="close"
            label="검색어 지우기"
            onClick={() => {
              setQuery("");
              setKeyword("");
            }}
          />
        )}
      </div>
      <div className="quarter-list">
        <div className="quarter-list-head" aria-hidden="true">
          <span>책 이름</span>
          <span>활동 기간</span>
        </div>
        {error ? (
          <Failure
            error={error}
            retry={() => {
              setError(null);
              setRevision((r) => r + 1);
            }}
          />
        ) : !result ? (
          <Loading />
        ) : books.length ? (
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
            {result.keyword ? (
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
        {!error && more > 0 && (
          <button
            type="button"
            className="quarter-more"
            onClick={() => setPaging({ key, count: visible + PAGE_SIZE })}
          >
            {more}권 더 보기 · {shown.length}/{books.length}
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
  // Show what the list already knows at once, then fill in the detail.
  const [detail, setDetail] = useState<RoadmapBookDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const c = new AbortController();
    api
      .request<RoadmapBookDetail>(`/api/roadmap/books/${book.bookId}`, {
        signal: c.signal,
      })
      .then((d) => {
        if (!c.signal.aborted) setDetail(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(detailError(e));
      });
    return () => c.abort();
  }, [api, book.bookId]);
  const title = detail?.title ?? book.title;
  const startDate = detail?.startDate ?? book.startDate;
  const endDate = detail ? detail.endDate : book.endDate;
  const ongoing = detail
    ? detail.status === "IN_PROGRESS"
    : isOngoing(book, today);
  const missing =
    error instanceof ApiError && (error.status === 404 || error.status === 403);
  return (
    <Modal title={`선택한 책: ${title}`} onClose={onClose} sheet className="roadmap-sheet">
      <div className="sheet-handle" />
      <div className="roadmap-sheet-close">
        <IconButton name="close" label="닫기" onClick={onClose} />
      </div>
      <small className="roadmap-sheet-eyebrow">선택한 책</small>
      <div className="roadmap-sheet-title">
        <h2>{title}</h2>
        {ongoing && <span className="ongoing">진행 중</span>}
      </div>
      <dl className="roadmap-sheet-info">
        <div>
          <dt>활동 기간</dt>
          <dd>
            {dateText(startDate)} ~ {endDate ? dateText(endDate) : "진행 중"}
          </dd>
        </div>
        <div>
          <dt>기록지</dt>
          <dd>{detail ? `${detail.pageCount}장` : "—"}</dd>
        </div>
      </dl>
      <ErrorMessage error={error} />
      <button
        type="button"
        className="primary tall"
        disabled={missing}
        onClick={onOpen}
      >
        책 속 기록 보기 →
      </button>
    </Modal>
  );
}

function detailError(e: unknown) {
  if (e instanceof ApiError && e.status === 404)
    return new ApiError("책을 찾을 수 없어요. 이미 삭제된 책일 수 있어요.", e.code, 404);
  if (e instanceof ApiError && e.status === 403)
    return new ApiError("이 책의 정보를 볼 수 없어요.", e.code, 403);
  return e;
}
