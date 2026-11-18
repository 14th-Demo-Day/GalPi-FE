import { useEffect, useState, useSyncExternalStore } from "react";
import type { ActivityApi } from "./api";
import type { Book, BookPage, BookPages } from "./types";
import { Bookshelf } from "./Bookshelf";
import { BookForm } from "./BookForm";
import { PageEditor } from "./PageEditor";
import { PageList } from "./PageList";
import { ExportScreen } from "./Export";
import { Failure, Loading } from "./ui";
import "./activity.css";

import { go, subscribeRoute, getRoute } from "./navigation";
export function ActivityApp({
  api,
  onNavigate,
}: {
  api: ActivityApi;
  onNavigate?: (destination: "roadmap" | "connections" | "settings") => void;
}) {
  const path = useSyncExternalStore(subscribeRoute, getRoute);
  const shelf = () => go("/activity");
  const page = (id: number) => go(`/activity/pages/${id}`);
  if (path === "/activity/new")
    return (
      <BookForm
        key={path}
        api={api}
        onBack={shelf}
        onCreated={page}
        onSaved={shelf}
        onDeleted={shelf}
      />
    );
  const match = path.match(
    /^\/activity\/(pages|books)\/(\d+)(?:\/(list|edit|export))?$/,
  );
  if (match)
    return (
      <LoadedRoute
        key={path}
        api={api}
        kind={match[1]}
        id={Number(match[2])}
        action={match[3]}
      />
    );
  return (
    <Bookshelf
      key={path}
      api={api}
      onCreate={() => go("/activity/new")}
      onBook={(id) => go(`/activity/books/${id}`)}
      onNavigate={onNavigate}
    />
  );
}
function LoadedRoute({
  api,
  kind,
  id,
  action,
}: {
  api: ActivityApi;
  kind: string;
  id: number;
  action?: string;
}) {
  const [data, setData] = useState<{
      page?: BookPage;
      book?: Book;
      list?: BookPages;
    } | null>(null),
    [error, setError] = useState<unknown>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    async function load() {
      if (kind === "pages") {
        const page = await api.page(id, c.signal);
        if (action === "edit")
          return { page, book: await api.book(page.bookId, c.signal) };
        if (action === "list" || action === "export")
          return { page, list: await api.pages(page.bookId, c.signal) };
        return { page };
      }
      const list = await api.pages(id, c.signal);
      if (action === "list" || !list.pages.length) return { list };
      return { page: await api.page(list.pages[0].pageId, c.signal) };
    }
    load()
      .then((result) => {
        if (!c.signal.aborted) {
          setData(result);
          setError(null);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e);
      });
    return () => c.abort();
  }, [api, kind, id, action, revision]);
  if (error)
    return (
      <section className="screen">
        <Failure error={error} retry={() => setRevision((v) => v + 1)} />
        <button className="return-shelf" onClick={() => go("/activity")}>
          책장으로 돌아가기
        </button>
      </section>
    );
  if (!data)
    return (
      <section className="screen">
        <Loading />
      </section>
    );
  const page = data.page,
    shelf = () => go("/activity"),
    toPage = (pageId: number) => go(`/activity/pages/${pageId}`);
  if (data.book && page)
    return (
      <BookForm
        api={api}
        book={data.book}
        onBack={() => toPage(page.pageId)}
        onCreated={toPage}
        onSaved={() => toPage(page.pageId)}
        onDeleted={shelf}
      />
    );
  if (data.list && action === "export" && page)
    return (
      <ExportScreen
        api={api}
        data={data.list}
        currentPageId={page.pageId}
        onClose={() => toPage(page.pageId)}
      />
    );
  if (data.list)
    return (
      <PageList
        api={api}
        data={data.list}
        currentPageId={page?.pageId}
        onBack={() => (page ? toPage(page.pageId) : shelf())}
        onPage={toPage}
      />
    );
  if (page)
    return (
      <PageEditor
        api={api}
        initialPage={page}
        onBack={shelf}
        onList={() => go(`/activity/pages/${page.pageId}/list`)}
        onEditBook={() => go(`/activity/pages/${page.pageId}/edit`)}
        onExport={() => go(`/activity/pages/${page.pageId}/export`)}
        onDeleted={(bookDeleted) =>
          bookDeleted ? shelf() : go(`/activity/books/${page.bookId}/list`)
        }
      />
    );
  return null;
}
