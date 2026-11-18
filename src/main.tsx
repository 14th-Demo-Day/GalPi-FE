import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { lazy, Suspense } from "react";
const Preview = import.meta.env.DEV
  ? lazy(() => import("./dev/preview"))
  : null;
const isPreview =
  import.meta.env.DEV && new URLSearchParams(location.search).has("preview");
if (isPreview) document.title = "갈피 · 개발용 미리보기 (서버 저장 없음)";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isPreview && Preview ? <Preview /> : <App />}
    </Suspense>
  </StrictMode>,
);
