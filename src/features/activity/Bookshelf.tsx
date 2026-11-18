import { useEffect, useState } from "react";
import type { ActivityApi } from "./api";
import { categories, dateText } from "./types";
import type { Book, Sort } from "./types";
import { Failure, Icon, IconButton, Loading } from "./ui";

import { BottomNav } from "./BottomNav";

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
      <BottomNav
        activeTab="activity"
        onNavigate={
          onNavigate && ((tab) => {
            if (tab !== "activity") onNavigate(tab);
          })
        }
      />
    </section>
  );
}
