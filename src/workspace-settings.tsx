import { useEffect, useId, useRef, type ReactNode } from "react";
import { Tooltip } from "antd";

export type SettingsTab = "models" | "local" | "general" | "about";

interface SettingsSection {
  key: SettingsTab;
  label: string;
  icon: ReactNode;
  children: ReactNode;
}

export function SettingsSections({ activeKey, onChange, label, items }: {
  activeKey: SettingsTab;
  onChange: (key: SettingsTab) => void;
  label: string;
  items: SettingsSection[];
}) {
  const id = useId();
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [activeKey]);

  return <main className="ws-settings">
    <nav className="ws-settings-navigation" aria-label={label}>
      {items.map(item => <Tooltip key={item.key} title={item.label} placement="right" trigger={["hover", "focus"]}>
        <button type="button" aria-label={item.label} aria-current={activeKey === item.key ? "page" : undefined}
          aria-controls={`${id}-${item.key}`} onClick={() => onChange(item.key)}>
          {item.icon}<span className="ws-settings-navigation-label">{item.label}</span>
        </button>
      </Tooltip>)}
    </nav>
    <div ref={content} className="ws-settings-content">
      {items.map(item => <section key={item.key} id={`${id}-${item.key}`} className="ws-settings-section" hidden={activeKey !== item.key}>
        <h2 className="ws-settings-section-label">{item.label}</h2>
        {item.children}
      </section>)}
    </div>
  </main>;
}
