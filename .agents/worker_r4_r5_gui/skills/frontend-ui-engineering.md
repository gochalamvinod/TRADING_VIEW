# Frontend UI Engineering Skill Summary
Source: `C:\Users\gocha\.gemini\config\plugins\agent-skills\skills\frontend-ui-engineering\SKILL.md`

## Core Methodology
- Avoid "AI Aesthetic": No purple/indigo defaults, no excessive gradients, no generic oversized rounded corners, no bloated shadows.
- Adhere to the host design system: Use authentic TradingView dark theme design tokens:
  - Background: `#131722`
  - Toolbar / Panel headers: `#1e222d`
  - Dividers / borders: `#2a2e39`
  - Interactive hover: `#2a2e39` / `#363a45`
  - Primary Accent Button ("Add to chart"): `#2962ff`, hover `#1e53e5`, active `#1848cc`
  - Text Primary: `#d1d4dc`
  - Text Muted: `#787b86`
  - Accent Green: `#089981`
  - Accent Red: `#f23645`
- Accessibility: Focus states, aria-labels on icon buttons, keyboard navigation.
- Responsive layout & Dock integration: Clean flex/grid dock, draggable splitter, clean tab integration.
