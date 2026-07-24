import type { ReactNode } from "react";

export type AppIconName =
  | "accounts"
  | "alumni"
  | "attendance"
  | "audit"
  | "classes"
  | "dashboard"
  | "import"
  | "profile"
  | "promotion"
  | "report"
  | "search"
  | "security"
  | "students";

type AppIconProps = {
  name: AppIconName;
  className?: string;
  title?: string;
};

export function AppIcon({ name, className = "h-5 w-5", title }: AppIconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  const icon = {
    accounts: (
      <>
        <path {...common} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle {...common} cx="9" cy="7" r="4" />
        <path {...common} d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    alumni: (
      <>
        <path {...common} d="m2 10 10-5 10 5-10 5L2 10Z" />
        <path {...common} d="M6 12.5V17c3 2 9 2 12 0v-4.5" />
        <path {...common} d="M22 10v6" />
      </>
    ),
    attendance: (
      <>
        <rect {...common} x="3" y="4" width="18" height="17" rx="2" />
        <path {...common} d="M8 2v4M16 2v4M3 9h18" />
        <path {...common} d="m8 14 2 2 5-5" />
      </>
    ),
    audit: (
      <>
        <path {...common} d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        <path {...common} d="M9 3h6v4H9zM8 12h5M8 16h3" />
        <circle {...common} cx="18" cy="8" r="3" />
        <path {...common} d="m20.2 10.2 2.3 2.3" />
      </>
    ),
    classes: (
      <>
        <rect {...common} x="3" y="4" width="18" height="16" rx="2" />
        <path {...common} d="M3 9h18M8 9v11M16 9v11" />
      </>
    ),
    dashboard: (
      <>
        <rect {...common} x="3" y="3" width="7" height="7" rx="1" />
        <rect {...common} x="14" y="3" width="7" height="7" rx="1" />
        <rect {...common} x="3" y="14" width="7" height="7" rx="1" />
        <rect {...common} x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    import: (
      <>
        <path {...common} d="M12 3v12" />
        <path {...common} d="m7 10 5 5 5-5" />
        <path {...common} d="M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2" />
      </>
    ),
    profile: (
      <>
        <circle {...common} cx="12" cy="8" r="4" />
        <path {...common} d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    promotion: (
      <>
        <path {...common} d="M7 17 17 7M9 7h8v8" />
        <path {...common} d="M5 4v16h16" />
      </>
    ),
    report: (
      <>
        <path {...common} d="M6 2h9l5 5v15H6z" />
        <path {...common} d="M14 2v6h6M9 13h7M9 17h7" />
      </>
    ),
    search: (
      <>
        <circle {...common} cx="11" cy="11" r="7" />
        <path {...common} d="m20 20-4-4" />
      </>
    ),
    security: (
      <>
        <path {...common} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path {...common} d="m9 12 2 2 4-4" />
      </>
    ),
    students: (
      <>
        <circle {...common} cx="9" cy="8" r="4" />
        <path {...common} d="M2 21a7 7 0 0 1 14 0" />
        <path {...common} d="M17 11h5M19.5 8.5v5" />
      </>
    ),
  } satisfies Record<AppIconName, ReactNode>;

  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      role={title ? "img" : undefined}
      viewBox="0 0 24 24"
    >
      {title ? <title>{title}</title> : null}
      {icon[name]}
    </svg>
  );
}
