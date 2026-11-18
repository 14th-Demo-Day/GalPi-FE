import { Icon } from "./ui";

const tabs = [
  { id: "roadmap", icon: "roadmap", label: "로드맵" },
  { id: "activity", icon: "activity", label: "활동" },
  { id: "connections", icon: "connection", label: "경험 연결" },
] as const;

type Tab = (typeof tabs)[number]["id"];

export function BottomNav({
  activeTab,
  onNavigate,
}: {
  activeTab: Tab;
  onNavigate?: (tab: Tab) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="주 메뉴">
      {tabs.map(({ id, icon, label }) => (
        <button
          key={id}
          type="button"
          aria-current={id === activeTab ? "page" : undefined}
          disabled={id !== activeTab && !onNavigate}
          onClick={id === activeTab ? undefined : () => onNavigate?.(id)}
        >
          <Icon name={icon} />
          {label}
        </button>
      ))}
    </nav>
  );
}
