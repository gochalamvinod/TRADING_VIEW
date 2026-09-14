# R3 Architecture Analysis: Unified Dark/Light Theme CSS Custom Properties

## 1. Executive Summary & Scope

The TradingView Advanced Pine Editor currently suffers from a split-personality CSS architecture:
1. **Lines 1–2154**: Originally designed around a hardcoded dark palette (`#131722`, `#1e222d`, `#2a2e39`, `#d1d4dc`, `#787b86`, `#2962ff`).
2. **Lines 2155–2646**: Appended as "Authentic TradingView 1:1 Pine Editor Styling", containing duplicated selector blocks (`#pine_editor_dock`, `.pine-workspace`, `.pine-gutter`, `.pine-editor-container`, `.pine-code-textarea`, `.pine-console-drawer-v2`, `.pine-bottom-statusbar-v2`) with hardcoded light theme colors (`#ffffff`, `#131722`, `#e0e3eb`, `#f0f3fa`) backed by `!important` declarations.
3. **The Core Defect**: Because lines 2155–2646 use `!important` on `#pine_editor_dock`, `.pine-workspace`, `.pine-gutter`, and `.pine-editor-container`, the editor dock is forced into a light theme even when the user selects Dark Mode, while toolbars, dropdowns, modals, and tabs remain dark. Neither dark nor light theme works cleanly or consistently.
4. **The Objective (R3)**:
   - Establish a centralized, semantic CSS Custom Property token architecture (`--tv-*`) scoped under `[data-theme="dark"]` and `[data-theme="light"]`.
   - Remove the duplicate appended rules in lines 2155–2646.
   - Replace all 377 hardcoded hex values and 53 rgba values with variable references.
   - Strip all theme-competing `!important` declarations.
   - Ensure full dark & light support for both the custom syntax backdrop (`.token-*`) and CodeMirror editor syntax classes (`.cm-*`).
   - Seamlessly synchronize with `setAppTheme(theme)` in `index.html` and `PineEditorIDE.setTheme(themeName)`.

---

## 2. Comprehensive Catalog of Hardcoded Colors

Detailed analysis of `pine_editor.css` reveals **377 instances** of hardcoded hex colors across **36 unique hex codes**, and **53 instances** of `rgba()` values across **39 unique expressions**.

### 2.1 Unique Hex Colors Breakdown

| Hex Code | Count | Semantic Role in TradingView | Proposed Token |
|---|---|---|---|
| `#2a2e39` | 50 | Primary dark border, separator, divider lines | `--tv-border` |
| `#787b86` | 43 | Muted text, secondary labels, disabled state, gutter numbers, inactive tabs | `--tv-text-muted` |
| `#d1d4dc` | 42 | Primary light text on dark surfaces, active header titles | `--tv-text-primary` |
| `#2962ff` | 35 | TradingView core blue brand accent, active tabs, buttons, focus borders | `--tv-accent` |
| `#131722` | 26 | Deep canvas background, main editor dock bg (Dark) / Text primary (Light) | `--tv-bg-primary` / `--tv-text-primary` |
| `#ffffff` / `#fff` | 40 | Pure white (Light bg / Dark high-contrast text, icons, button text) | `--tv-white` / `--tv-bg-primary` |
| `#1e222d` | 20 | Secondary elevated dark bg (toolbar, drawer, popover headers, cards) | `--tv-bg-secondary` |
| `#363a45` | 18 | Hover background for dark buttons, menu items, table rows | `--tv-surface-hover` |
| `#f23645` | 17 | Bearish red, compilation error text, delete button, close hover | `--tv-color-error` / `--tv-color-bearish` |
| `#089981` | 9 | Bullish green, compilation success indicator, active status dot | `--tv-color-success` / `--tv-color-bullish` |
| `#f0f3fa` | 9 | Light theme hover surface, light gutter divider, light active row | `--tv-surface-hover` (Light) |
| `#ff9800` | 8 | Warning badge, caution alerts, revision change tag | `--tv-color-warning` |
| `#e0e3eb` | 8 | Light theme primary border, divider, table border | `--tv-border` (Light) |
| `#181b24` | 7 | Ultra-dark container background (console terminal drawer, code backdrop) | `--tv-bg-tertiary` |
| `#1e53e5` | 6 | Accent hover state (TradingView blue hover) | `--tv-accent-hover` |
| `#f7a600` | 6 | TradingView amber/gold accent (warnings, stars, favorites) | `--tv-color-warning-secondary` |
| `#b2b5be` | 5 | Secondary text muted (lighter than #787b86, used in modal descriptions) | `--tv-text-secondary` |
| `#4a4e59` | 3 | Button borders, active pill borders in dark theme | `--tv-border-hover` |
| `#5d606b` | 3 | Inactive icons, subtle outlines | `--tv-icon-muted` |
| `#88c0d0` | 3 | Syntax token: types (`int`, `float`), operators (`+`, `-`) | `--tv-syn-type` / `--tv-syn-operator` |
| `#1848cc` | 2 | Accent active/pressed state (TradingView blue active) | `--tv-accent-active` |
| `#d08770` | 2 | Syntax token: keywords (`indicator`, `strategy`, `if`, `var`) | `--tv-syn-keyword` |
| `#ebcb8b` | 2 | Syntax token: namespaces (`ta.`, `math.`, `request.`) | `--tv-syn-namespace` |
| `#a3be8c` | 2 | Syntax token: strings (`"text"`) | `--tv-syn-string` |
| `#8b949e` | 1 | Git/diff metadata text | `--tv-text-subtle` |
| `#f59e0b` | 1 | Syntax token: compiler version directive (`//@version=N`) | `--tv-syn-version` |
| `#81a1c1` | 1 | Syntax token: built-in functions (`sma`, `rsi`, `ema`) | `--tv-syn-function` |
| `#b48ead` | 1 | Syntax token: numbers and numeric literals (`10`, `3.14`) | `--tv-syn-number` |
| `#ff0000` | 1 | Hard error highlight fallback | `--tv-color-error-bright` |
| `#5e81ac` | 1 | Syntax token: built-in series variables (`open`, `high`, `low`, `close`) | `--tv-syn-builtin` |
| `#fde8e8` | 1 | Light theme error banner / delete button hover bg | `--tv-color-error-bg` |
| `#fff8e1` | 1 | Light theme warning banner background | `--tv-color-warning-bg` |
| `#ffe082` | 1 | Light theme warning banner border | `--tv-color-warning-border` |
| `#b45309` | 1 | Light theme warning banner text | `--tv-color-warning-text` |
| `#fafbfc` | 1 | Light theme secondary surface / minimap background | `--tv-bg-secondary` (Light) |

### 2.2 RGBA Colors Breakdown & Semantic Mapping

There are 53 instances of `rgba()` colors. They fall into 5 distinct categories:

1. **Brand Blue Transparencies (`rgba(41, 98, 255, ...)` - 13 instances)**:
   - `rgba(41, 98, 255, 0.05)`: Light hover highlight on action items
   - `rgba(41, 98, 255, 0.10)` / `0.12` / `0.15`: Tab hover / badge backgrounds
   - `rgba(41, 98, 255, 0.20)` / `0.40`: Textarea selection background (`.pine-code-textarea::selection`)
   - `rgba(41, 98, 255, 0.45)` / `0.50` / `0.60` / `0.85`: Gutter active line highlight jump & focus glows
   *Mapped Token*: `--tv-accent-tint-5`, `--tv-accent-tint-15`, `--tv-editor-selection`, `--tv-accent-glow`

2. **Success Green Transparencies (`rgba(8, 153, 129, ...)` - 6 instances)**:
   - `rgba(8, 153, 129, 0.08)` / `0.12` / `0.15` / `0.20`: Success toast, compiled badge background, status chip
   *Mapped Token*: `--tv-color-success-bg`

3. **Error Red Transparencies (`rgba(242, 54, 69, ...)` - 6 instances)**:
   - `rgba(242, 54, 69, 0.06)` / `0.12` / `0.15` / `0.25`: Error line in gutter, compilation failure banner, error badge
   *Mapped Token*: `--tv-color-error-bg`, `--tv-color-error-tint`

4. **Warning Amber Transparencies (`rgba(255, 152, 0, ...)` and `rgba(247, 166, 0, ...)` - 5 instances)**:
   - `rgba(255, 152, 0, 0.06)` / `0.12` / `0.25`: Warning pill bg, dirty script indicator, alert item highlight
   *Mapped Token*: `--tv-color-warning-bg`

5. **Neutral Dark/Light Transparencies (`rgba(0, 0, 0, ...)` - 13 instances; `rgba(255, 255, 255, ...)` - 6 instances)**:
   - `rgba(0, 0, 0, 0.4)` to `0.8`: Modal backdrop masks (`.tv-indicators-modal-backdrop`, `.pine-revisions-modal`), popover shadows
   - `rgba(255, 255, 255, 0.02)` / `0.04` / `0.08`: Dark theme subtle button hovers, legend action hover
   *Mapped Token*: `--tv-modal-mask`, `--tv-surface-hover-subtle`, `--tv-shadow-elevation`

---

## 3. Catalog & Categorization of `!important` Overrides

There are **88 occurrences** of `!important` in `pine_editor.css`. They are distributed across distinct functional zones:

### 3.1 Category A: The Appended Light-Theme Hijack (Lines 2155–2646) — 13 `!important` Overrides
**Root Cause**: When adding an initial light-theme attempt, duplicate selectors were placed at the bottom of the file with `!important` to stomp on the dark styles above them.
- Line 2159: `#pine_editor_dock { background: #ffffff !important; }`
- Line 2160: `#pine_editor_dock { color: #131722 !important; }`
- Line 2161: `#pine_editor_dock { border-left: 1px solid #e0e3eb !important; }`
- Line 2162: `#pine_editor_dock { font-family: -apple-system, ... !important; }`
- Line 2533: `.pine-workspace { background: #ffffff !important; }`
- Line 2541: `.pine-gutter { background: #ffffff !important; }`
- Line 2542: `.pine-gutter { border-right: 1px solid #f0f3fa !important; }`
- Line 2543: `.pine-gutter { color: #787b86 !important; }`
- Line 2550: `.pine-editor-container { background: #ffffff !important; }`
- Line 2558: `.pine-code-textarea { background: transparent !important; }`
- Line 2559: `.pine-code-textarea { color: #131722 !important; }`
- Line 2560: `.pine-code-textarea { caret-color: #131722 !important; }`
- Line 2561-2564: `.pine-code-textarea { font-family, font-size, line-height, padding-right !important; }`

**Resolution Plan**: **ELIMINATE ENTIRELY**. Remove lines 2155–2646. Replace them by binding `#pine_editor_dock`, `.pine-workspace`, `.pine-gutter`, `.pine-editor-container`, and `.pine-code-textarea` to CSS custom properties (`var(--tv-bg-primary)`, `var(--tv-text-primary)`, `var(--tv-border)`, etc.) in their primary definitions.

### 3.2 Category B: Custom Syntax Textarea Transparency Layering (Lines 997–1018) — 18 `!important` Overrides
**Root Cause**: The Pine Script IDE implements syntax highlighting via a two-layer technique:
- Layer 1 (Backdrop): `.pine-syntax-code` renders colored syntax tokens.
- Layer 2 (Overlay): `.pine-code-textarea` is overlaid with `color: transparent !important`, `-webkit-text-fill-color: transparent !important`, `background: transparent !important`, but visible `caret-color: var(--tv-accent)` and translucent selection `background: var(--tv-editor-selection) !important; color: transparent !important;`.
- These `!important` flags were added to prevent browser user-agent stylesheets or conflicting framework classes from making textarea text visible and double-rendering over the syntax backdrop.

**Resolution Plan**: Retain structural transparency (`color: transparent`, `background: transparent`) where necessary, but replace hardcoded colors:
- `caret-color: #2962ff !important;` → `caret-color: var(--tv-accent);` (remove `!important`)
- `background: rgba(41, 98, 255, 0.4) !important;` → `background: var(--tv-editor-selection);`

### 3.3 Category C: Chart Legend Polish & Defect Fixes (Lines 855–944) — 25 `!important` Overrides
**Root Cause**: Target elements inside the TradingView chart container (e.g. `[data-name="legend-interval-show-hide-action"]`, `.actions-l31H9iuA`, `[class*="valuesWrapper"]`). These need to override minified obfuscated CSS classes injected by TradingView library script bundles.
- Lines 860–869: Hiding crossed-eye interval icon (`display: none !important; width: 0 !important; visibility: hidden !important;`)
- Lines 877–889: Legend values layout alignment (`display: inline-flex !important; max-width: 65vw !important;`)
- Lines 936, 943, 944: Action buttons hover colors:
  * Line 936: `color: #787b86 !important;` → `color: var(--tv-text-muted);`
  * Line 943: `color: #d1d4dc !important;` → `color: var(--tv-text-primary);`
  * Line 944: `background-color: rgba(255, 255, 255, 0.08) !important;` → `background-color: var(--tv-surface-hover);`

**Resolution Plan**: Keep structural overrides that hide defective TradingView Charting Library elements (`display: none !important`), but convert all color rules (`color`, `background-color`) to use `var(--tv-*)`.

### 3.4 Category D: Gutter Error & Highlight Jump (Lines 722–731) — 5 `!important` Overrides
- Line 722: `.pine-gutter-line.error { color: #f23645 !important; }`
- Lines 728–731: `.pine-gutter-line.highlight-line-jump { color: #ffffff !important; font-weight: 700 !important; background: rgba(41, 98, 255, 0.45) !important; border-left: 3px solid #2962ff !important; }`

**Resolution Plan**: Remove `!important` by giving `.pine-gutter-line.error` and `.pine-gutter-line.highlight-line-jump` sufficient selector specificity (`.pine-gutter .pine-gutter-line.error`), and bind to `var(--tv-color-error)` and `var(--tv-accent)`.

### 3.5 Category E: Bottom Dock Custom Tabs Active State (Lines 847–848) — 2 `!important` Overrides
- Line 847: `color: #2962ff !important;`
- Line 848: `border-bottom-color: #2962ff !important;`

**Resolution Plan**: Remove `!important` by using specificity `.tv-custom-bottom-tab.active button`, and bind to `var(--tv-accent)`.

---

## 4. Complete CSS Custom Property Architecture Design

The theme architecture is designed with high cohesion and strict naming symmetry. All tokens use the `--tv-` namespace. The tokens are defined at root scopes:
- `html[data-theme="dark"]`, `[data-theme="dark"]`, `.theme-dark`
- `html[data-theme="light"]`, `[data-theme="light"]`, `.theme-light`
- Fallback on `:root` defaults to `dark`.

```css
/* =========================================================================
   TRADINGVIEW DUAL-THEME DESIGN SYSTEM TOKENS
   ========================================================================= */

:root,
html[data-theme="dark"],
[data-theme="dark"],
.theme-dark {
  /* ── Core Canvas & Surfaces ── */
  --tv-bg-primary: #131722;
  --tv-bg-secondary: #1e222d;
  --tv-bg-tertiary: #181b24;
  --tv-surface-hover: #2a2e39;
  --tv-surface-active: #363a45;
  --tv-surface-hover-subtle: rgba(255, 255, 255, 0.04);

  /* ── Borders & Dividers ── */
  --tv-border: #2a2e39;
  --tv-border-subtle: #1e222d;
  --tv-border-hover: #363a45;

  /* ── Typography & Content ── */
  --tv-text-primary: #d1d4dc;
  --tv-text-secondary: #b2b5be;
  --tv-text-muted: #787b86;
  --tv-text-disabled: #4a4e59;
  --tv-text-inverted: #131722;

  /* ── Brand Accent (Blue) ── */
  --tv-accent: #2962ff;
  --tv-accent-hover: #1e53e5;
  --tv-accent-active: #1848cc;
  --tv-accent-tint-5: rgba(41, 98, 255, 0.05);
  --tv-accent-tint-12: rgba(41, 98, 255, 0.12);
  --tv-accent-tint-15: rgba(41, 98, 255, 0.15);
  --tv-accent-glow: rgba(41, 98, 255, 0.45);

  /* ── Semantic Feedback ── */
  --tv-color-success: #089981;
  --tv-color-success-hover: #07806c;
  --tv-color-success-bg: rgba(8, 153, 129, 0.15);

  --tv-color-error: #f23645;
  --tv-color-error-hover: #cc2433;
  --tv-color-error-bg: rgba(242, 54, 69, 0.15);

  --tv-color-warning: #f7a600;
  --tv-color-warning-secondary: #ff9800;
  --tv-color-warning-bg: rgba(255, 152, 0, 0.15);
  --tv-color-warning-border: rgba(255, 152, 0, 0.3);
  --tv-color-warning-text: #ebcb8b;

  /* ── Editor Canvas & Gutter ── */
  --tv-editor-bg: #131722;
  --tv-editor-gutter-bg: #131722;
  --tv-editor-gutter-border: #2a2e39;
  --tv-editor-gutter-text: #787b86;
  --tv-editor-gutter-text-active: #d1d4dc;
  --tv-editor-selection: rgba(41, 98, 255, 0.35);
  --tv-editor-caret: #2962ff;
  --tv-editor-current-line: rgba(255, 255, 255, 0.03);

  /* ── Minimap ── */
  --tv-minimap-bg: #181b24;
  --tv-minimap-border: #2a2e39;
  --tv-minimap-slider: rgba(255, 255, 255, 0.08);

  /* ── Status Bar & Console ── */
  --tv-statusbar-bg: #1e222d;
  --tv-statusbar-border: #2a2e39;
  --tv-statusbar-text: #787b86;
  --tv-statusbar-text-hover: #d1d4dc;

  --tv-console-bg: #181b24;
  --tv-console-border: #2a2e39;
  --tv-console-text: #d1d4dc;
  --tv-console-text-muted: #787b86;

  /* ── Modals, Popovers & Dialogs ── */
  --tv-modal-bg: #1e222d;
  --tv-modal-border: #2a2e39;
  --tv-modal-mask: rgba(0, 0, 0, 0.7);
  --tv-dropdown-bg: #1e222d;
  --tv-dropdown-border: #2a2e39;
  --tv-dropdown-hover: #2a2e39;
  --tv-dropdown-active: #363a45;
  --tv-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);

  /* ── Syntax Highlighting (Dark: Nord / TradingView Dark) ── */
  --tv-syn-comment: #787b86;
  --tv-syn-version: #f59e0b;
  --tv-syn-keyword: #d08770;
  --tv-syn-type: #88c0d0;
  --tv-syn-namespace: #ebcb8b;
  --tv-syn-function: #81a1c1;
  --tv-syn-string: #a3be8c;
  --tv-syn-number: #b48ead;
  --tv-syn-operator: #88c0d0;
  --tv-syn-builtin: #5e81ac;
  --tv-syn-identifier: #d1d4dc;
}

html[data-theme="light"],
[data-theme="light"],
.theme-light {
  /* ── Core Canvas & Surfaces ── */
  --tv-bg-primary: #ffffff;
  --tv-bg-secondary: #fafbfc;
  --tv-bg-tertiary: #f0f3fa;
  --tv-surface-hover: #f0f3fa;
  --tv-surface-active: #e0e3eb;
  --tv-surface-hover-subtle: rgba(0, 0, 0, 0.04);

  /* ── Borders & Dividers ── */
  --tv-border: #e0e3eb;
  --tv-border-subtle: #f0f3fa;
  --tv-border-hover: #d1d4dc;

  /* ── Typography & Content ── */
  --tv-text-primary: #131722;
  --tv-text-secondary: #4a4e59;
  --tv-text-muted: #787b86;
  --tv-text-disabled: #b2b5be;
  --tv-text-inverted: #ffffff;

  /* ── Brand Accent (Blue) ── */
  --tv-accent: #2962ff;
  --tv-accent-hover: #1e53e5;
  --tv-accent-active: #1848cc;
  --tv-accent-tint-5: rgba(41, 98, 255, 0.05);
  --tv-accent-tint-12: rgba(41, 98, 255, 0.08);
  --tv-accent-tint-15: rgba(41, 98, 255, 0.12);
  --tv-accent-glow: rgba(41, 98, 255, 0.25);

  /* ── Semantic Feedback ── */
  --tv-color-success: #089981;
  --tv-color-success-hover: #07806c;
  --tv-color-success-bg: rgba(8, 153, 129, 0.12);

  --tv-color-error: #f23645;
  --tv-color-error-hover: #cc2433;
  --tv-color-error-bg: #fde8e8;

  --tv-color-warning: #f59e0b;
  --tv-color-warning-secondary: #d97706;
  --tv-color-warning-bg: #fff8e1;
  --tv-color-warning-border: #ffe082;
  --tv-color-warning-text: #b45309;

  /* ── Editor Canvas & Gutter ── */
  --tv-editor-bg: #ffffff;
  --tv-editor-gutter-bg: #ffffff;
  --tv-editor-gutter-border: #f0f3fa;
  --tv-editor-gutter-text: #787b86;
  --tv-editor-gutter-text-active: #131722;
  --tv-editor-selection: rgba(41, 98, 255, 0.2);
  --tv-editor-caret: #2962ff;
  --tv-editor-current-line: rgba(0, 0, 0, 0.02);

  /* ── Minimap ── */
  --tv-minimap-bg: #fafbfc;
  --tv-minimap-border: #f0f3fa;
  --tv-minimap-slider: rgba(0, 0, 0, 0.06);

  /* ── Status Bar & Console ── */
  --tv-statusbar-bg: #ffffff;
  --tv-statusbar-border: #e0e3eb;
  --tv-statusbar-text: #787b86;
  --tv-statusbar-text-hover: #131722;

  --tv-console-bg: #ffffff;
  --tv-console-border: #e0e3eb;
  --tv-console-text: #131722;
  --tv-console-text-muted: #787b86;

  /* ── Modals, Popovers & Dialogs ── */
  --tv-modal-bg: #ffffff;
  --tv-modal-border: #e0e3eb;
  --tv-modal-mask: rgba(0, 0, 0, 0.4);
  --tv-dropdown-bg: #ffffff;
  --tv-dropdown-border: #e0e3eb;
  --tv-dropdown-hover: #f0f3fa;
  --tv-dropdown-active: #e0e3eb;
  --tv-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);

  /* ── Syntax Highlighting (Light: TradingView Native Light) ── */
  --tv-syn-comment: #787b86;
  --tv-syn-version: #d97706;
  --tv-syn-keyword: #d03050;
  --tv-syn-type: #00897b;
  --tv-syn-namespace: #c25e00;
  --tv-syn-function: #005fb8;
  --tv-syn-string: #089981;
  --tv-syn-number: #8e24aa;
  --tv-syn-operator: #5d606b;
  --tv-syn-builtin: #1e53e5;
  --tv-syn-identifier: #131722;
}
```

### 4.1 Syntax Highlighting & CodeMirror Token Mapping

To ensure 100% compatibility whether the editor runs with the custom backdrop highlighter or CodeMirror, both mapping layers are styled using the identical CSS custom properties:

```css
/* ── Custom Backdrop Syntax Tokens ── */
.token-comment   { color: var(--tv-syn-comment); font-style: italic; }
.token-version   { color: var(--tv-syn-version); font-weight: 600; }
.token-keyword   { color: var(--tv-syn-keyword); font-weight: 600; }
.token-type      { color: var(--tv-syn-type); }
.token-namespace { color: var(--tv-syn-namespace); font-weight: 500; }
.token-function  { color: var(--tv-syn-function); }
.token-string    { color: var(--tv-syn-string); }
.token-number    { color: var(--tv-syn-number); }
.token-operator  { color: var(--tv-syn-operator); }
.token-builtin   { color: var(--tv-syn-builtin); font-weight: 500; }

/* ── CodeMirror Theme Classes (cm-s-tv-theme / cm-s-default) ── */
.cm-s-tv-dark, .cm-s-tv-light, .CodeMirror {
  background: var(--tv-editor-bg);
  color: var(--tv-text-primary);
}
.CodeMirror-gutters {
  background: var(--tv-editor-gutter-bg);
  border-right: 1px solid var(--tv-editor-gutter-border);
}
.CodeMirror-linenumber {
  color: var(--tv-editor-gutter-text);
}
.CodeMirror-cursor {
  border-left: 2px solid var(--tv-editor-caret);
}
.CodeMirror-selected {
  background: var(--tv-editor-selection);
}
.cm-s-tv-dark .cm-comment, .cm-s-tv-light .cm-comment       { color: var(--tv-syn-comment); font-style: italic; }
.cm-s-tv-dark .cm-keyword, .cm-s-tv-light .cm-keyword       { color: var(--tv-syn-keyword); font-weight: 600; }
.cm-s-tv-dark .cm-type, .cm-s-tv-light .cm-type             { color: var(--tv-syn-type); }
.cm-s-tv-dark .cm-variable, .cm-s-tv-light .cm-variable     { color: var(--tv-text-primary); }
.cm-s-tv-dark .cm-variable-2, .cm-s-tv-light .cm-variable-2 { color: var(--tv-syn-builtin); }
.cm-s-tv-dark .cm-def, .cm-s-tv-light .cm-def               { color: var(--tv-syn-function); }
.cm-s-tv-dark .cm-string, .cm-s-tv-light .cm-string         { color: var(--tv-syn-string); }
.cm-s-tv-dark .cm-number, .cm-s-tv-light .cm-number         { color: var(--tv-syn-number); }
.cm-s-tv-dark .cm-operator, .cm-s-tv-light .cm-operator     { color: var(--tv-syn-operator); }
.cm-s-tv-dark .cm-builtin, .cm-s-tv-light .cm-builtin       { color: var(--tv-syn-builtin); font-weight: 500; }
```

---

## 5. Refactoring Plan for `pine_editor.css`

To achieve 100% clean CSS variable resolution and completely eliminate color bugs:

### Step 1: Prepend Dual-Theme Custom Property Block
Insert the complete `:root`, `[data-theme="dark"]`, and `[data-theme="light"]` token definitions at the very beginning of `pine_editor.css` (lines 1–12).

### Step 2: Delete Duplicate Conflicting Block (Lines 2155–2646)
Remove lines 2155 through 2646 completely. This immediately eliminates:
- The 13 aggressive `!important` declarations forcing light backgrounds onto `#pine_editor_dock`, `.pine-workspace`, `.pine-gutter`, and `.pine-editor-container`.
- The duplicate, mismatched styles for `.pine-console-drawer-v2` and `.pine-bottom-statusbar-v2`.

### Step 3: Replace Hardcoded Values in Core Components (Lines 13–2154)
Update each major section of `pine_editor.css`:

1. **Root & Dock Containers**:
   - `#app_root`: `background-color: var(--tv-bg-primary); color: var(--tv-text-primary);`
   - `#pine_editor_dock`: `background: var(--tv-bg-primary); border-left: 1px solid var(--tv-border); color: var(--tv-text-primary);`
   - `#pine_resize_handle:hover, #pine_resize_handle.dragging`: `background: var(--tv-accent);`

2. **Top Toolbar**:
   - `.pine-toolbar`: `background: var(--tv-bg-secondary); border-bottom: 1px solid var(--tv-border);`
   - `.pine-btn`: `background: var(--tv-bg-secondary); border: 1px solid var(--tv-border); color: var(--tv-text-primary);`
   - `.pine-btn:hover`: `background: var(--tv-surface-hover); border-color: var(--tv-border-hover);`
   - `.pine-btn.primary`: `background: var(--tv-accent); color: var(--tv-text-inverted);`
   - `.pine-btn.primary:hover`: `background: var(--tv-accent-hover);`

3. **Dropdown Menus & Popovers**:
   - `.pine-dropdown-menu`, `.pine-header-dropdown-menu`: `background: var(--tv-dropdown-bg); border: 1px solid var(--tv-dropdown-border); box-shadow: var(--tv-shadow);`
   - `.pine-dropdown-item`: `color: var(--tv-text-primary);`
   - `.pine-dropdown-item:hover`: `background: var(--tv-dropdown-hover);`

4. **Workspace & Gutter**:
   - `.pine-workspace`: `background: var(--tv-editor-bg);`
   - `.pine-gutter`: `background: var(--tv-editor-gutter-bg); border-right: 1px solid var(--tv-editor-gutter-border); color: var(--tv-editor-gutter-text);`
   - `.pine-gutter-line.error`: `color: var(--tv-color-error); background: var(--tv-color-error-bg);` (no `!important`)
   - `.pine-gutter-line.highlight-line-jump`: `color: var(--tv-text-inverted); background: var(--tv-accent-glow); border-left: 3px solid var(--tv-accent);` (no `!important`)

5. **Console & Compiler Drawer**:
   - `.pine-console-drawer`: `background: var(--tv-console-bg); border-top: 1px solid var(--tv-console-border);`
   - `.pine-console-header`: `background: var(--tv-bg-secondary); border-bottom: 1px solid var(--tv-border);`
   - Console logs: `color: var(--tv-console-text);`
   - Timestamp/source: `color: var(--tv-console-text-muted);`

6. **Status Bar**:
   - `.pine-statusbar`: `background: var(--tv-statusbar-bg); border-top: 1px solid var(--tv-statusbar-border); color: var(--tv-statusbar-text);`
   - Status indicators: `color: var(--tv-statusbar-text-hover);`

7. **Modals (Indicators, Revisions, Strategy Tester, Settings Dialog)**:
   - Modals: `background: var(--tv-modal-bg); border: 1px solid var(--tv-modal-border);`
   - Backdrops: `background: var(--tv-modal-mask);`
   - Inputs, search boxes: `background: var(--tv-bg-tertiary); border: 1px solid var(--tv-border); color: var(--tv-text-primary);`

---

## 6. Integration with `PineEditorIDE.setTheme(themeName)` & `index.html`

In `index.html`, `setAppTheme()` already executes:
```javascript
document.documentElement.setAttribute('data-theme', theme.toLowerCase());
const appRoot = document.getElementById('app_root');
if (appRoot) {
  appRoot.setAttribute('data-theme', theme.toLowerCase());
  appRoot.classList.toggle('theme-light', theme === 'Light');
  appRoot.classList.toggle('theme-dark', theme === 'Dark');
}
if (window.PineEditorIDE && typeof window.PineEditorIDE.setTheme === 'function') {
  window.PineEditorIDE.setTheme(theme);
}
if (widget && typeof widget.changeTheme === 'function') {
  widget.changeTheme(theme.toLowerCase());
}
```

To complete this contract:
1. `PineEditorIDE.setTheme(themeName)` should be added to `pine_editor_ide.js`:
```javascript
setTheme(themeName) {
  const theme = (themeName && themeName.toLowerCase() === 'light') ? 'light' : 'dark';
  const dock = document.getElementById('pine_editor_dock');
  if (dock) {
    dock.setAttribute('data-theme', theme);
  }
  // If CodeMirror instance exists:
  if (this._cmInstance) {
    this._cmInstance.setOption('theme', theme === 'light' ? 'tv-light' : 'tv-dark');
  }
}
```
2. Because CSS tokens are declared on `html[data-theme]`, `[data-theme]`, and `.theme-*`, as soon as `setAppTheme()` runs, ALL colors in both the chart container and Pine Editor instantly resolve without page reload!
