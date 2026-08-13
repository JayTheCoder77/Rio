# Code Review Platform — Frontend Design Spec

## Product
A code review platform whose primary clients are a CLI and a GitHub App.
Secondary surfaces: Docs, Install page, Auth, Dashboard (analytics + API keys), future integrations.

## Visual Language (inspired by Ando)
- Website Link of Ando for reference - https://www.ando.so/?ref=seesaw
- Extremely clean, high whitespace, modern SaaS
- Soft product mockups on subtle atmospheric backgrounds
- Typography: Inter or Geist (clean, technical)
- Colors: Near-black text, soft gray secondary, one accent (recommend soft blue or indigo)
- Light + Dark mode from day one
- Cards with subtle borders / soft shadows, blue accent ring on interactive states
- Rounded corners (lg / xl), generous padding

## Site Map & Pages

### Public
1. Landing (`/`)
2. Docs (`/docs` or external)
3. Install (`/install`) → contains GitHub App + CLI options
4. Auth pages (login / signup)

### Authenticated
5. Dashboard (`/dashboard`) — Analytics overview
6. API Keys (`/dashboard/api-keys`)
7. Settings / Profile
8. Sidebar

## Key Components & Behavior

### Landing
- Hero: Big headline + short subtext + email/waitlist or “Get access” CTA + floating product mockup (CLI terminal + GitHub PR review UI)
- Feature section: 3 cards (similar to Ando’s “Bring your own agents / Share context / Let them chime in”)
- Comparison or “How it works” section
- Final CTA
- Footer with Social / Company / Info columns + big faded logo treatment

### Install Page (`/install`)
- Clear two-path layout:
  - GitHub App (primary) — big button + short explanation
  - CLI — install command + tabs for different package managers / OS
- Optional deep links / one-click install where possible

### Dashboard
- Left sidebar (collapsible on mobile)
  - Analytics
  - API Keys
  - Integrations (Slack, Discord, etc. marked “Coming soon”)
  - Docs / Support
- Main area: Analytics charts + recent activity
- Clean, dense but readable data UI (still respectful of whitespace)

### Auth & API Keys
- Simple, modern auth UI (email + GitHub OAuth preferred)
- After login → redirect to dashboard
- API Keys page: create / revoke / copy keys with clear scoping

## Technical Stack (Next.js)
- Next.js 15 (App Router)
- Tailwind CSS + shadcn/ui
- next-themes for light/dark
- Lucide icons
- Framer Motion for subtle animations (optional but recommended)
- Auth: NextAuth.js / Clerk / Auth.js (your choice)
- Charts: Recharts or Tremor


## Proposed Structure

app/
├── (marketing)/
│   ├── page.tsx              # Landing
│   ├── install/page.tsx      # Install (GitHub App + CLI)
│   ├── docs/                 # or redirect to external docs
│   └── layout.tsx            # Marketing layout (nav + footer)
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (dashboard)/
│   ├── layout.tsx            # Sidebar layout
│   ├── page.tsx              # Analytics
│   ├── api-keys/page.tsx
│   └── settings/page.tsx
├── api/                      # API routes -> # only if needed
└── globals.css