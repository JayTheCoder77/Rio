# Landing Page Spec — Rio (Code Review Platform)

**Inspiration**: [ando.so](https://www.ando.so) — clean, minimal, high-contrast, generous whitespace, sharp typography, subtle motion, no heavy chrome.

**Product positioning**:  
“The code review platform for developers”

**Primary goal of the page**:  
Make it immediately clear what Rio is, show the two ways to use it (GitHub App + CLI), tease the dashboard + upcoming integrations, and drive the “Get Access” / Install CTA.

---

## Global

- **Smooth scrolling** on the entire page (`scroll-behavior: smooth` + optional Lenis or similar for premium feel).
- Dark / Light mode toggle (persisted).
- Clean, borderless navbar — no background box or heavy shadow.
- Video placeholders everywhere videos will live (clearly marked so they’re easy to swap later).
- Consistent spacing rhythm and strong visual hierarchy.
- Mobile-first, but designed to feel premium on desktop.

---

## 1. Navbar

**Layout** (full width, sticky or fixed, transparent / minimal background):

| Left          | Center | Right                                      |
|---------------|--------|--------------------------------------------|
| **Rio** (logo / wordmark) | Docs   | Get Access button + Dark/Light toggle     |

- **Rio** (left) → links to home / top of page.
- **Docs** (center) → links to documentation.
- **Get Access** (right) → primary CTA button. Redirects to the install / waitlist / access flow.
- **Dark / Light switch** sits immediately beside the Get Access button.
- No box, no border, no heavy background on the navbar itself. Keep it extremely clean.
- On mobile: collapse into a simple hamburger or keep a very minimal version.

---

## 2. Hero Section

**Layout**: Two-column on desktop, stacked on mobile.

### Left side
- Large, bold headline:  
  **The code review platform for developers**
- Optional short supporting line underneath (1 sentence max). Keep it tight.
- Primary CTA can be repeated here if desired (“Get Access”).

### Right side
- Video placeholder box (aspect ratio ~16:9 or slightly taller).
- Clearly labeled as “Hero video placeholder” so it can be replaced later with the main product demo / walkthrough.

**Visual style**:
- Generous top padding under the navbar.
- Strong contrast between text and background.
- The video box should feel like a polished product shot / demo window (subtle border or soft shadow depending on theme).

---

## 3. Ways to Review Section

**Section heading** (centered or left-aligned, clear hierarchy):  
**Ways to review.**

Two clear options side-by-side (or stacked on mobile):

| Left box                          | Right box                         |
|-----------------------------------|-----------------------------------|
| **Want GitHub?**                  | **Want local?**                   |
| Use the app                       | Use the CLI                       |
| Video placeholder (GitHub App)    | Video placeholder (CLI)           |

- Each box contains:
  - Short label / title
  - One-line description
  - Video placeholder (clearly marked for the live demos you’ll upload later)
- The two boxes should feel equal in weight and visually balanced.
- Optional subtle hover or focus state on the boxes.

---

## 4. Features Section

**Section heading**:  
**Features**

### Available now
- **Dashboard with analytics**
- **API keys for CLI**

Display these as clean, readable items (can be simple text blocks or light cards).

### Coming Soon
Show these in **medium-sized boxes** (consistent size, good visual weight):

- Slack integration
- Discord integration
- Improved context handling
- Memory
- Tools (MCP)

Each coming-soon box should have:
- Feature name
- Very short description (1 line)
- Optional “Coming soon” badge or subtle indicator

Layout recommendation: grid of medium boxes (2 or 3 columns on desktop).

---

## 5. Footer

Minimal footer containing:

- Social links (X / Twitter, GitHub, Discord, etc. — decide which ones)
- Optional small copyright / “Rio” wordmark
- Keep it light and uncluttered (Ando-style)

---

## Design Notes (Ando-inspired)

- Extremely clean typography hierarchy.
- Lots of breathing room between sections.
- High contrast in both light and dark modes.
- No unnecessary borders, cards with heavy shadows, or decorative lines unless they serve clarity.
- Video placeholders should look intentional (nice empty state with subtle border / icon / label).
- Motion: smooth scroll + subtle fade-ins or gentle transitions on section entry (keep it restrained).
- The overall feel should be “serious developer tool that still feels modern and approachable”.

---

## Content Placeholders Summary

| Location              | Type                  | Notes                                      |
|-----------------------|-----------------------|--------------------------------------------|
| Hero right side       | Video placeholder     | Main product demo                          |
| Ways to Review – left | Video placeholder     | GitHub App live demo                       |
| Ways to Review – right| Video placeholder     | CLI live demo                              |

---

## Implementation Priorities

1. Navbar + Hero (strong first impression)
2. Smooth scroll + dark/light mode
3. Ways to Review section with two video slots
4. Features + Coming Soon grid
5. Footer

---

**Next steps after this spec**:
- Decide exact copy for the short supporting lines
- Choose final social links for the footer
- Prepare the three videos (hero + GitHub App + CLI)