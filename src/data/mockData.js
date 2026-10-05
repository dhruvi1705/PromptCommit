// Configuration for AI Toolkit Utilities
// Obsolete mock users, initial mock prompts, initial mock activities,
// and simulated playground responses have been retired and migrated
// to the persistent MySQL database (promptcommit_db).

export const AI_TOOLKIT_ITEMS = [
  {
    id: "tool-gen",
    title: "Prompt Generator",
    description: "Turn simple 1-line ideas into comprehensive, role-based system prompts with structured constraints.",
    icon: "Sparkles",
    tag: "Creation",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
    placeholder: "e.g. A prompt to extract sentiment and actionable feature requests from App Store reviews..."
  },
  {
    id: "tool-opt",
    title: "Prompt Optimizer",
    description: "Refactor vague prompts to remove ambiguity, reduce token consumption, and eliminate hallucinations.",
    icon: "Zap",
    tag: "Performance",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
    placeholder: "Paste an existing prompt that produces inconsistent or verbose results..."
  },
  {
    id: "tool-rewrite",
    title: "Prompt Rewriter",
    description: "Adapt your prompts for structured model architectures (e.g. Markdown instructions, XML tags, and JSON schemas).",
    icon: "RefreshCw",
    tag: "Adaptation",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800",
    placeholder: "Paste a prompt to rewrite with XML tags or strict JSON schemas..."
  },
  {
    id: "tool-trans",
    title: "Prompt Translator",
    description: "Translate prompts across natural languages while maintaining nuanced terminology, idioms, and system constraints.",
    icon: "Languages",
    tag: "Localization",
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800",
    placeholder: "Enter English prompt and desired target language (Spanish, Japanese, German, etc.)..."
  },
  {
    id: "tool-score",
    title: "Prompt Scorer",
    description: "Evaluate your prompt across 5 key dimensions: Clarity, Specificity, Robustness, Token Economy, and Safety.",
    icon: "Gauge",
    tag: "Evaluation",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800",
    placeholder: "Paste your prompt to generate a 0-100 quality scorecard..."
  },
  {
    id: "tool-explain",
    title: "Prompt Explainer",
    description: "Deconstruct why a complex multi-stage prompt works and identify latent assumptions in its prompt chain.",
    icon: "HelpCircle",
    tag: "Analysis",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700",
    placeholder: "Paste a complex or long system prompt to receive a breakdown of its logic..."
  }
];
