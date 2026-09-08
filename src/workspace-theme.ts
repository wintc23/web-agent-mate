import { theme, type ThemeConfig } from "antd";

// CSS semantic tokens are the source of truth for both custom UI and Ant Design.
export function workspaceTheme(dark: boolean): ThemeConfig {
  const styles = getComputedStyle(document.documentElement);
  const color = (name: string) => styles.getPropertyValue(`--${name}`).trim();
  const primary = color("brand-action");
  const hover = color("brand-hover");
  const surface = color("surface");
  const semantic = {
    colorPrimary: primary, colorPrimaryHover: hover, colorPrimaryActive: hover,
    colorPrimaryText: primary, colorPrimaryTextHover: hover, colorPrimaryTextActive: hover,
    colorPrimaryBg: color("user-message"), colorPrimaryBgHover: color("brand-soft"),
    colorPrimaryBorder: primary, colorPrimaryBorderHover: hover,
    colorLink: primary, colorLinkHover: hover, colorLinkActive: hover,
    colorInfo: primary, colorInfoText: primary, colorInfoTextHover: hover, colorInfoTextActive: hover,
    colorInfoBg: color("brand-soft"), colorInfoBgHover: color("user-message"), colorInfoBorder: color("brand-soft"), colorInfoBorderHover: primary,
    colorSuccess: color("success"), colorSuccessText: color("success"), colorSuccessBg: color("success-bg"), colorSuccessBorder: color("success-bg"),
    colorWarning: color("warning"), colorWarningText: color("warning"), colorWarningBg: color("warning-bg"), colorWarningBorder: color("warning-bg"),
    colorError: color("error"), colorErrorText: color("error"), colorErrorBg: color("error-bg"), colorErrorBorder: color("error-bg"),
    colorBgBase: color("canvas"), colorBgLayout: color("canvas"), colorBgContainer: surface,
    colorBgElevated: color("surface-raised"), colorBgSpotlight: color("surface-inverse"),
    colorText: color("text-primary"), colorTextHeading: color("text-primary"), colorTextLabel: color("text-primary"),
    colorTextSecondary: color("text-secondary"), colorTextDescription: color("text-secondary"), colorTextPlaceholder: color("text-secondary"),
    colorTextLightSolid: color("on-brand"), colorBorder: color("border-control"), colorBorderSecondary: color("border-subtle"),
    controlItemBgHover: color("surface-muted"), controlItemBgActive: color("user-message"), controlItemBgActiveHover: color("brand-soft"),
    colorFillAlter: color("surface-muted"), colorBgMask: color("backdrop")
  };
  return {
    algorithm: seed => ({ ...(dark ? theme.darkAlgorithm(seed) : theme.defaultAlgorithm(seed)), ...semantic }),
    token: { ...semantic, borderRadius: 10, fontSize: 13, controlHeight: 36, fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" },
    components: {
      Button: { primaryShadow: "none", primaryColor: color("on-brand"), dangerColor: color("on-status") },
      Drawer: { footerPaddingBlock: 14 }, Cascader: { controlItemWidth: 110, dropdownHeight: 280 },
      Tooltip: { colorTextLightSolid: color("text-inverse") },
      Segmented: { trackBg: color("surface-muted"), itemSelectedBg: surface, itemSelectedColor: color("text-primary") }
    }
  };
}
