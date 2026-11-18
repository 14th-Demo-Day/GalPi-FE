import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { lazy, Suspense } from "react";
const Preview = import.meta.env.DEV
  ? lazy(() => import("./dev/preview"))
  : null;
// Until the backend is connected, the dev server runs the full app (login included)
// on the in-memory preview API. Production builds never load these fixtures.
const MockApp =
  import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL
    ? lazy(() =>
        import("./dev/previewApi").then((m) => ({
          default: () => <App api={m.previewApi} />,
        })),
      )
    : null;
const isPreview =
  import.meta.env.DEV && new URLSearchParams(location.search).has("preview");
if (isPreview) document.title = "갈피 · 개발용 미리보기 (서버 저장 없음)";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isPreview && Preview ? <Preview /> : MockApp ? <MockApp /> : <App />}
    </Suspense>
  </StrictMode>,
);
