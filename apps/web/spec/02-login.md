# Login Page Spec — Rio

**Inspiration**: Ando.so aesthetic — minimal, high-contrast, generous whitespace, sharp typography, no visual clutter.

**Purpose**:  
Single-purpose authentication page.  
Only one login method: **GitHub OAuth**.

**Goal**:  
Make signing in feel fast, trustworthy, and frictionless.  
Zero distractions. One clear action.

---

## Layout Overview

**Desktop**: Split layout (roughly 50/50 or 55/45)

| Left side                        | Right side                              |
|----------------------------------|-----------------------------------------|
| Video placeholder                | Login content (centered vertically)     |

**Mobile**:  
- Video can be hidden, reduced, or moved above the form.  
- Login content takes priority and stays clean.

---

## Left Side — Video Placeholder

- Full-height (or nearly full-height) video area.
- Clean placeholder box with subtle border or soft background depending on theme.
- Clearly labeled internally as “Login page video placeholder” so it can be swapped later.
- Suggested content later: short product demo, code review in action, or ambient product footage.
- No text overlay required on the video itself (keep it pure).

---

## Right Side — Login Content

Vertically centered content with generous breathing room.

### Elements (top to bottom):

1. **Logo / Wordmark**  
   - “Rio” (same as navbar style)  
   - Optional small tagline underneath if desired (keep it very short)

2. **Heading**  
   - Primary text: **Sign in to Rio**  
   - Optional secondary line: “The code review platform for developers” (subtle, smaller weight)

3. **Primary Action**  
   - Large, clean **“Sign in with GitHub”** button  
   - GitHub icon on the left of the button text  
   - Strong visual weight (primary button style)  
   - Full width of the content column or comfortably wide  
   - Clear hover / focus / active states

4. **Supporting text** (optional, keep minimal)  
   - Small line under the button such as:  
     “Only GitHub authentication is supported.”  
     or  
     “We’ll never post without your permission.”

5. **Footer links** (very subtle)  
   - Terms of Service  
   - Privacy Policy  
   - (Optional) Back to home

---

## Design Principles

- Extremely clean — no extra form fields, no email/password, no social alternatives.
- High contrast in both light and dark mode.
- The GitHub button should feel like the only important element on the right side.
- Generous vertical spacing so the page doesn’t feel cramped.
- Smooth page load (no jarring transitions).
- Same dark/light mode system as the main site (respect user preference or system setting).

---

## Button Specification

**Sign in with GitHub**

- Style: Primary button (filled)
- Icon: Official GitHub mark (left of text)
- Text: “Sign in with GitHub”
- Behavior: Redirects to GitHub OAuth flow
- States: Default, Hover, Focus, Loading (show subtle spinner or disabled state while redirecting)

---

## Responsive Behavior

| Breakpoint     | Behavior                                      |
|----------------|-----------------------------------------------|
| Desktop        | Split layout (video left, login right)        |
| Tablet         | Split or stacked (prefer keeping video if space allows) |
| Mobile         | Stacked — login content first, video secondary or hidden |

---

## Content Placeholders

| Location          | Type               | Notes                                      |
|-------------------|--------------------|--------------------------------------------|
| Left side         | Video placeholder  | Product / demo footage                     |

---

## Implementation Notes

- No traditional form. Only the OAuth button.
- Handle OAuth errors gracefully (show a clean, minimal error message if authentication fails).
- After successful login → redirect to dashboard or intended destination.
- Keep the page feeling like a natural extension of the landing page (same fonts, colors, spacing language).

---

**Priority order**:
1. Clean split layout + video placeholder
2. Strong, centered “Sign in with GitHub” button
3. Dark / light mode consistency
4. Mobile stacking behavior