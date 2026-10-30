---
name: NCEA to ATAR Estimator
description: Estimate your Australian Tertiary Admission Rank from New Zealand NCEA results.
colors:
  kiln-terracotta: "#C2552D"
  terracotta-light: "#D4724E"
  terracotta-dark: "#A3461F"
  warm-parchment: "#F5F0EB"
  card-white: "#FEFEFE"
  elevated-linen: "#F9F6F2"
  hover-sand: "#F0EAE3"
  active-clay: "#E8E0D8"
  dark-walnut: "#2D2520"
  driftwood: "#8A7E72"
  muted-stone: "#B5A99D"
  border-taupe: "#D4C9BC"
  border-strong: "#B5A99D"
  grade-excellence: "#C4962D"
  grade-merit: "#4A7A8C"
  grade-achieved: "#5B8A3C"
  grade-not-achieved: "#B33A3A"
typography:
  display:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.15em"
  mono:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.kiln-terracotta}"
    textColor: "#FEFEFE"
    rounded: "{rounded.none}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.terracotta-light}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.driftwood}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.hover-sand}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.grade-not-achieved}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  input-default:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.dark-walnut}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  panel:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.none}"
    padding: "24px"
  badge-primary:
    backgroundColor: "rgba(194, 85, 45, 0.08)"
    textColor: "{colors.kiln-terracotta}"
    rounded: "{rounded.none}"
    padding: "2px 10px"
  badge-ue:
    backgroundColor: "rgba(91, 138, 60, 0.06)"
    textColor: "{colors.grade-achieved}"
    rounded: "{rounded.none}"
    padding: "0 6px"
---

# Design System: NCEA to ATAR Estimator

## 1. Overview

**Creative North Star: "The Tutor's Desk"**

A sharp, knowledgeable friend's workspace: clean, structured, everything where you'd expect it, with just enough personality to not feel institutional. The system favours warm earthy tones over clinical whites, sharp geometric forms over rounded softness, and precise typographic hierarchy over decorative flourish.

The aesthetic is Bauhaus-inflected: every element is a deliberate rectangular block, every corner is hard-cut, every surface earns its place through function. But the palette tempers that rigour with warmth. The background is parchment, not paper. The accent is terracotta, not red. The result feels like a well-organised desk belonging to someone who actually knows the NCEA system, not a government portal pretending to.

This is a single-purpose calculator for NZ Year 13 students exploring "what if" scenarios after mock results. The interface respects their intelligence and their time. It does not gamify, does not onboard, does not upsell. It answers one question clearly.

**Key Characteristics:**
- Sharp, zero-radius geometry on every element (enforced globally)
- Warm, earthy palette that avoids clinical or institutional tones
- Monospace numerals for data; humanist sans for everything else
- Staggered entry animations that feel responsive, never choreographed
- Flat surfaces at rest; shadows appear only as hover or elevation feedback
- Dense information display that trusts the user to scan

## 2. Colors: The Kiln Palette

Warm, desaturated, earthy. The palette draws from fired clay and aged paper. Color is used with restraint: the terracotta primary appears on buttons, active states, and key numerals, occupying less than 10% of any given screen. Everything else is tinted neutrals.

### Primary
- **Kiln Terracotta** (#C2552D): The single accent colour. Buttons, active indicators, standard numbers, the ATAR headline, and the logo's forward stroke. Used sparingly to mark interactive or important elements.
- **Terracotta Light** (#D4724E): Hover state for primary buttons. Slightly lifted, slightly warmer.
- **Terracotta Dark** (#A3461F): Pressed/active state. Deeper, more grounded.

### Neutral
- **Warm Parchment** (#F5F0EB): Page background. The base canvas, tinted warm to avoid the sterile feel of pure white.
- **Card White** (#FEFEFE): Panel and card backgrounds. Near-white, never pure white.
- **Elevated Linen** (#F9F6F2): Elevated surfaces, section headers, secondary panels. One step warmer than the card.
- **Hover Sand** (#F0EAE3): Interactive hover state for neutral surfaces.
- **Active Clay** (#E8E0D8): Active/pressed state, subtle borders, and the lightest border treatment.
- **Dark Walnut** (#2D2520): Primary text and the logo's rear stroke. Nearly black, but tinted warm.
- **Driftwood** (#8A7E72): Secondary text. Readable but receded.
- **Muted Stone** (#B5A99D): Tertiary text, scrollbar thumbs, placeholder text.
- **Border Taupe** (#D4C9BC): Default borders. Soft, barely there.
- **Border Strong** (#B5A99D): Emphasised borders on hover or focus.

### Semantic: Grade Colours
- **Excellence Gold** (#C4962D): Excellence grade indicator. Muted gold, not bright yellow.
- **Merit Teal** (#4A7A8C): Merit grade indicator. Desaturated teal-blue.
- **Achieved Green** (#5B8A3C): Achieved grade indicator and UE badge. Earthy green.
- **Not Achieved Red** (#B33A3A): Not Achieved grade indicator. Muted brick red.

### Named Rules
**The 10% Rule.** Kiln Terracotta occupies no more than 10% of any screen. Its rarity is the point. When everything is parchment and walnut, a terracotta button or number immediately draws the eye. Flooding the page with it would collapse the hierarchy.

**The No-Pure-White Rule.** Neither `#000000` nor `#FFFFFF` appear anywhere in the system. Every neutral is tinted toward the warm hue family. Card White is `#FEFEFE`, not `#FFFFFF`. Dark Walnut is `#2D2520`, not `#000000`.

## 3. Typography

**Display Font:** DM Sans (with system sans-serif fallback)
**Mono Font:** IBM Plex Mono (with system monospace fallback)

**Character:** DM Sans is geometric but not cold, with slightly humanist curves that soften the Bauhaus geometry of the layout. IBM Plex Mono handles every number that matters: ATAR scores, standard numbers, credit counts, statistical values. The pairing gives numerals a precision that DM Sans alone would lack.

### Hierarchy
- **Display** (700, clamp(1.75rem, 4vw, 2.25rem), 1.15, -0.02em): Page title ("NCEA results to an ATAR."). One per page.
- **Headline** (700, 1rem/16px, 1.3, -0.01em): Section headers ("Your portfolio", "Contribution breakdown"). Tight tracking.
- **Title** (700, 0.875rem/14px, 1.4, tight): Card titles, standard titles, subject headings. The workhorse.
- **Body** (400, 0.875rem/14px, 1.6, normal): Descriptive text, explanations, tooltips.
- **Label** (700, 0.625rem/10px, 1.2, 0.15em, UPPERCASE): Section labels, metadata ("CREDITS", "VERSION", "WEIGHT"). Always uppercase, always bold, always tracked wide. The system's most distinctive typographic voice.
- **Mono** (700, varies, 1.4): ATAR numbers (up to 5rem for the hero), standard numbers, credit counts, statistical values. IBM Plex Mono, always bold.

### Named Rules
**The Label Voice Rule.** Labels are always 10px, bold, uppercase, tracked at 0.15em, in Muted Stone or Driftwood. They whisper metadata. Never sentence case, never regular weight, never larger than 10px.

**The Mono-for-Numbers Rule.** Any number that represents data (ATAR score, standard number, credit count, weight percentage, year) is set in IBM Plex Mono. DM Sans handles words; Plex Mono handles numbers. No exceptions.

## 4. Elevation

The system is flat by default. Surfaces sit flush at rest. Shadow appears only as a response to user action (hover, focus) or to establish a clear hierarchy break (modals, dropdowns over content).

### Shadow Vocabulary
- **Card Rest** (`0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`): Default panel/card shadow. Barely visible. Separates the card from the parchment base without lifting it.
- **Card Hover** (`0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)`): Applied on hover with a -0.5px translateY. The card lifts subtly.
- **Focus Ring** (`0 0 0 2px rgba(194,85,45,0.25)`): Focus/active indicator. A soft terracotta glow, not a hard ring.
- **Modal** (`0 8px 30px rgba(0,0,0,0.12)`): Modals and portalled dropdowns. The heaviest shadow in the system. Still restrained.

### Named Rules
**The Flat-at-Rest Rule.** Shadows exist only as state feedback. A card at rest has the card-rest shadow (barely there). Hover lifts it to card-hover. Nothing floats permanently. If an element needs visual separation without interaction, use a border or background tint, not a shadow.

## 5. Components

Every component is sharp-cornered (0px radius, enforced by a global `* { border-radius: 0 !important }` rule). The system is tactile and structured: components feel like typeset blocks in a Bauhaus print.

### Buttons
- **Shape:** Hard-cut rectangles (0px radius). No rounding, ever.
- **Primary:** Kiln Terracotta background, near-white text. Padding 10px 20px. Uppercase, bold, letter-spacing 0.2em, text-xs. On hover: Terracotta Light background, -1px translateY, card-hover shadow. On active: translateY(0), shadow removed, scale(0.98).
- **Ghost:** Transparent background, Border Taupe border, Driftwood text. On hover: Hover Sand background, Border Strong border, Dark Walnut text.
- **Danger:** Transparent background, light red border, Not Achieved Red text. On hover: light red background fill.
- **Full-width CTA:** The "Calculate estimate" button spans full width with extra vertical padding (20px), same terracotta treatment. Disabled state: 50% opacity, not-allowed cursor.

### Panels / Cards
- **Corner Style:** 0px radius (hard-cut).
- **Background:** Card White (#FEFEFE).
- **Border:** 1px solid Border Taupe.
- **Shadow:** Card Rest at rest; Card Hover on hover (with -0.5px lift).
- **Internal Padding:** 24px default (p-6), 32px for hero sections (p-8), 16px for compact data panels (p-4).
- **`.panel`** is the base. **`.panel-card`** adds hover lift. There is no nested card pattern.

### Inputs / Fields
- **Style:** Card White background, 1px Border Taupe border, 0px radius.
- **Padding:** 12px 16px.
- **Focus:** 2px terracotta ring (rgba(194,85,45,0.25)), border shifts to primary.
- **Placeholder:** Muted Stone, 12px, tracked slightly wider than body text.

### Badges
- **Primary badge:** Terracotta-tinted background (8% opacity), Kiln Terracotta text, terracotta border at 20% opacity. Uppercase, bold, tracked wide.
- **UE badge:** Achieved Green tint, compact (4px vertical padding). Indicates University Entrance eligibility.

### Grade Selector
A distinctive component: a segmented button bar with N/A/M/E (or N/A for Unit Standards). Each segment is 36x32px, separated by the bar's border. The active segment fills with the grade's colour (solid background, white text). Inactive segments show Muted Stone text with hover feedback.

### Navigation
- **Header:** Fixed top, 56px tall. Card White background at 95% opacity with backdrop blur. 1px bottom border.
- **Logo:** 32x32px SVG mark (overlapping N and A letterforms in Kiln Terracotta and Dark Walnut).
- **Links:** Body weight, Driftwood colour, transition to Dark Walnut on hover.
- **Beta label:** 10px, uppercase, tracked at 0.15em, Muted Stone. Sits right-aligned in the header.

### Empty States
Centred layout with a 56x56px icon container (Card White background, Border Taupe border), followed by a bold secondary-text headline, a Muted Stone description, and an optional primary CTA.

## 6. Do's and Don'ts

### Do:
- **Do** use the Label Voice for all metadata (10px, bold, uppercase, 0.15em tracking, Muted Stone or Driftwood).
- **Do** set every number in IBM Plex Mono, bold. Standard numbers, credit counts, ATAR scores, weights, years.
- **Do** keep Kiln Terracotta under 10% of any screen. Use it on: primary buttons, active states, key numerals, the logo.
- **Do** use staggered entry animations with `calc(var(--stagger-index) * 40ms)` delay for lists of items. Keep individual durations at 250-400ms with ease-out curves.
- **Do** use 1px Border Taupe borders to separate sections. Borders are structural, not decorative.
- **Do** present ATAR estimates as estimates. Use language like "estimated", "calculated using [year] weights". Never present a number as definitive.

### Don't:
- **Don't** use border-radius on anything. The global `border-radius: 0 !important` rule is absolute. If you're tempted to round a corner, the element is wrong, not the rule.
- **Don't** gamify the interface. No streaks, badges for engagement, progress bars for completion, confetti, or celebratory animations. The tool answers a question; it doesn't reward using it.
- **Don't** build a generic SaaS dashboard. No sidebar navigation, no settings pages with toggle grids, no onboarding wizards. This is a single-page calculator with two supporting pages.
- **Don't** make it feel like a government form. No grey-on-grey inputs, no "Section 4b" labelling, no walls of legalese above the fold. The disclaimer exists in the footer; it doesn't dominate.
- **Don't** use `#000000` or `#FFFFFF`. Every dark is tinted warm (Dark Walnut #2D2520). Every white is off-white (Card White #FEFEFE, Warm Parchment #F5F0EB).
- **Don't** use gradient text (`background-clip: text`), glassmorphism as decoration, or side-stripe accent borders (`border-left` > 1px). Exception: the grade accent stripe on selected standards uses a 4px `border-left` in the grade colour. This is the only permitted instance.
- **Don't** animate layout properties (width, height, padding). Use opacity and transform only. The one exception is the remove-item height collapse, which animates `height` with `will-change` set explicitly.
- **Don't** use bounce or elastic easing. All motion uses exponential ease-out or cubic-bezier curves like `(0.25, 0.1, 0.25, 1)` and `(0.34, 1.56, 0.64, 1)`.
