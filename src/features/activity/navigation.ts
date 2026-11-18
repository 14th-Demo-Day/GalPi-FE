const DEFAULT_ROUTE = "/login";
let current = window.location.hash.slice(1) || DEFAULT_ROUTE;
let guard: ((continueNavigation: () => void) => void) | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
function commit(path: string) {
  current = path;
  window.location.hash = path;
  window.scrollTo({ top: 0 });
  notify();
}
export function go(path: string) {
  if (path === current) return;
  if (guard) guard(() => commit(path));
  else commit(path);
}
export function registerNavigationGuard(
  callback: (continueNavigation: () => void) => void,
) {
  guard = callback;
  return () => {
    if (guard === callback) guard = undefined;
  };
}
const handleHashChange = () => {
  const target = window.location.hash.slice(1) || DEFAULT_ROUTE;
  if (target === current) return;
  if (guard) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${current}`,
    );
    guard(() => commit(target));
  } else {
    current = target;
    notify();
  }
};
window.addEventListener("hashchange", handleHashChange);
if (import.meta.hot)
  import.meta.hot.dispose(() =>
    window.removeEventListener("hashchange", handleHashChange),
  );
export const subscribeRoute = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getRoute = () => current;
