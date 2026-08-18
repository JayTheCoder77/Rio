# Main Application Spec — Rio (Post-login)

**Inspiration**: Ando.so — minimal, high-contrast, generous whitespace, clean typography, no visual noise.

**Purpose**:  
The authenticated experience. Everything lives inside a persistent sidebar + main content area.

---

## Global Layout

**Structure**:
- Fixed left sidebar (collapsible on mobile)
- Main content area on the right
- Top bar optional (can be minimal or omitted if sidebar is strong enough)

**Sidebar width**: ~240–260px on desktop  
**Dark / Light mode**: Fully supported and consistent with landing + login pages.

---

## Sidebar Navigation

**Items** (in order):

| Item            | Route / Behavior              | Notes                              |
|-----------------|-------------------------------|------------------------------------|
| **Dashboard**   | `/dashboard`                  | Default landing page after login   |
| **API Keys**    | `/api-keys`                   | Create & manage keys               |
| **Integrations**| `/integrations`               | Coming soon                        |
| **Settings**    | `/settings`                   | Account + Sign out                 |

- Active state should be clearly visible (subtle background + stronger text weight).
- Logo / “Rio” wordmark at the top of the sidebar.
- User avatar + name (from GitHub) can sit at the bottom of the sidebar (optional but recommended).

---

## 1. Dashboard (`/dashboard`)

**Purpose**: Overview of usage and connected repositories.

### Sections

**A. Analytics Overview**
- Key metrics cards (examples):
  - Total reviews this week / month
  - Average review time
  - Repos connected
  - API calls (if relevant)
- Clean metric cards with large numbers + short labels.
- Optional simple charts (line / bar) — keep them very light.

**B. Connected Repositories**
- List or table of repos the user has connected via the GitHub App.
- Columns / info:
  - Repo name + owner
  - Last reviewed
  - Status (Active / Needs attention)
  - Quick actions (View, Disconnect)
- Empty state: “No repositories connected yet” + clear CTA to install the GitHub App / connect repos.

---

## 2. API Keys (`/api-keys`)

**Purpose**: Let users create and manage API keys for the CLI.

### Features
- List of existing API keys (name, created date, last used, partial key preview).
- **Create new key** button → opens a modal or inline form:
  - Name / label (required)
  - Optional expiration
  - Generate → show the full key **once** with a clear “Copy” button and warning that it won’t be shown again.
- Ability to revoke / delete keys.
- Empty state: “No API keys yet. Create one to use the CLI.”

**Security note**: Never show the full key again after the initial creation.

---

## 3. Integrations (`/integrations`)

**Purpose**: Showcase upcoming integrations.

- Heading: **Integrations**
- Subtext: “More ways to bring Rio into your workflow. Coming soon.”
- Medium-sized cards for:
  - Slack
  - Discord
  - (Any others you plan)
- Each card: icon + name + short description + “Coming soon” badge.
- Keep the section calm and intentional — no fake “notify me” forms unless you actually want them.

---

## 4. Settings (`/settings`)

**Purpose**: Account information + sign out.

### Sections

**A. Account**
- Data fetched from GitHub OAuth:
  - Avatar
  - Name
  - Username / handle
  - Email (if available)
  - GitHub profile link
- Read-only for now (no editing of GitHub data).

**B. Sign out**
- Clear, secondary-style **Sign out** button.
- Confirm dialog optional but recommended.

---

## Design Notes

- Sidebar should feel light and permanent.
- Content areas use generous padding and clear section hierarchy.
- Empty states are important — make them helpful and on-brand.
- Loading states: subtle skeletons or spinners, never jarring.
- Consistent with the overall Rio visual language (typography, spacing, contrast).