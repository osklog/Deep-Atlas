const ACCENT = "#C9A96E";
const ACCENT_DIM = "#A07E4A";
const ACCENT_GLOW = "#C9A96E22";

const TEAL = "#4ECDC4";
const TEAL_DIM = "#38A89D";

const BG_DEEPEST = "#0A0C10";
const BG_DEEP = "#0E1117";
const BG_CARD = "#141820";
const BG_ELEVATED = "#1C2230";
const BG_SURFACE = "#232B3A";

const BORDER_SUBTLE = "#1E2636";
const BORDER_MID = "#2A3548";

const TEXT_PRIMARY = "#EDF0F5";
const TEXT_SECONDARY = "#8A95A8";
const TEXT_MUTED = "#4E5A6E";

const NODE_CONCEPT = "#6E9CF0";
const NODE_PERSON = "#F0A66E";
const NODE_COMPANY = "#6EF0C4";
const NODE_SOURCE = "#C46EF0";
const NODE_QUESTION = "#F0E96E";
const NODE_EVENT = "#F06E6E";
const NODE_HYPOTHESIS = "#6EF08A";
const NODE_QUOTE = "#F06EB8";
const NODE_MEDIA = "#6ED4F0";

export default {
  dark: {
    background: BG_DEEPEST,
    backgroundDeep: BG_DEEP,
    backgroundCard: BG_CARD,
    backgroundElevated: BG_ELEVATED,
    backgroundSurface: BG_SURFACE,
    borderSubtle: BORDER_SUBTLE,
    borderMid: BORDER_MID,
    text: TEXT_PRIMARY,
    textSecondary: TEXT_SECONDARY,
    textMuted: TEXT_MUTED,
    tint: ACCENT,
    tintDim: ACCENT_DIM,
    tintGlow: ACCENT_GLOW,
    teal: TEAL,
    tealDim: TEAL_DIM,
    tabIconDefault: TEXT_MUTED,
    tabIconSelected: ACCENT,
    nodeColors: {
      concept: NODE_CONCEPT,
      person: NODE_PERSON,
      company: NODE_COMPANY,
      source: NODE_SOURCE,
      question: NODE_QUESTION,
      event: NODE_EVENT,
      hypothesis: NODE_HYPOTHESIS,
      quote: NODE_QUOTE,
      media: NODE_MEDIA,
    },
  },
};

export type ColorScheme = typeof Colors.dark;
const Colors = { dark: {
  background: BG_DEEPEST,
  backgroundDeep: BG_DEEP,
  backgroundCard: BG_CARD,
  backgroundElevated: BG_ELEVATED,
  backgroundSurface: BG_SURFACE,
  borderSubtle: BORDER_SUBTLE,
  borderMid: BORDER_MID,
  text: TEXT_PRIMARY,
  textSecondary: TEXT_SECONDARY,
  textMuted: TEXT_MUTED,
  tint: ACCENT,
  tintDim: ACCENT_DIM,
  tintGlow: ACCENT_GLOW,
  teal: TEAL,
  tealDim: TEAL_DIM,
  tabIconDefault: TEXT_MUTED,
  tabIconSelected: ACCENT,
  nodeColors: {
    concept: NODE_CONCEPT,
    person: NODE_PERSON,
    company: NODE_COMPANY,
    source: NODE_SOURCE,
    question: NODE_QUESTION,
    event: NODE_EVENT,
    hypothesis: NODE_HYPOTHESIS,
    quote: NODE_QUOTE,
    media: NODE_MEDIA,
  },
}};
