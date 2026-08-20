export type DocsItem = { id: string; label: string };
export type DocsGroup = { id: string; label: string; items: DocsItem[] };

export const DOCS_NAV: DocsGroup[] = [
  { id: "introduction", label: "Introduction", items: [] },
  {
    id: "getting-started",
    label: "Getting started",
    items: [
      { id: "installation", label: "Installation" },
      { id: "quickstart", label: "Quickstart" },
    ],
  },
  {
    id: "github-app",
    label: "GitHub App",
    items: [
      { id: "installing-app", label: "Installing the app" },
      { id: "how-reviews-work", label: "How reviews work" },
    ],
  },
  {
    id: "cli",
    label: "CLI",
    items: [
      { id: "cli-install", label: "Installation" },
      { id: "cli-auth", label: "Authentication (API keys)" },
      { id: "cli-reference", label: "Commands reference" },
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    items: [{ id: "rio-yml", label: ".rio.yml reference" }],
  },
  {
    id: "guides",
    label: "Guides",
    items: [
      { id: "best-practices", label: "Best practices" },
      { id: "troubleshooting", label: "Troubleshooting" },
    ],
  },
  { id: "changelog", label: "Changelog", items: [] },
];

// Every heading id on the page, in document order. Used by the scroll-spy
// for the active-section highlight in the sidebar.
export const DOCS_HEADINGS: string[] = DOCS_NAV.flatMap((group) =>
  group.items.length > 0
    ? [group.id, ...group.items.map((item) => item.id)]
    : [group.id],
);