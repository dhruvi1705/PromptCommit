import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  Lock,
  GitBranch,
  PlaySquare,
  GitCompare,
  Wand2,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Zap,
  Code2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedFeature, setSelectedFeature] = React.useState(null);

  const handleLaunch = (targetRoute = '/app') => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      navigate(targetRoute);
    }
  };

  const features = [
    {
      id: "vault",
      icon: Lock,
      title: "1. Private Prompt Workspace",
      description: "Zero public leaks. Every prompt, snippet, and experimental chain is strictly isolated in your encrypted personal vault.",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-100",
      route: "/app/prompts",
      badge: "Zero-Knowledge Storage",
      details: "Your prompts and system instructions are isolated in a local client-side vault. Data never leaves your machine unless explicitly tested, guaranteeing 100% intellectual property security.",
      highlights: [
        "Client-side sandboxed local vault",
        "Custom collections & tag organization",
        "Export in Markdown, JSON, and Plain Text"
      ]
    },
    {
      id: "versions",
      icon: GitBranch,
      title: "2. Prompt Version Control",
      description: "Git-inspired commit history for every prompt iteration. Roll back to any snapshot instantly with detailed diff notes.",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-100",
      route: "/app/versions",
      badge: "Git-Style VCS",
      details: "Track evolutionary prompt revisions just like software code. Tag version bumps (v1.0 → v1.1 → v2.0), annotate commit rationale, and perform 1-click rollbacks.",
      highlights: [
        "Major & minor semantic version tags",
        "Chronological commit tree with diffs",
        "Instant 1-click snapshot restore"
      ]
    },
    {
      id: "playground",
      icon: PlaySquare,
      title: "3. Prompt Playground",
      description: "Simulate multi-model execution across Google Gemini, Groq, OpenRouter, and Mistral AI with variable parameters.",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-100",
      route: "/app/playground",
      badge: "Multi-Model Sandbox",
      details: "Test your prompts across fast cloud AI APIs. Fine-tune temperature, max token limits, and simulate real-world user queries in real-time.",
      highlights: [
        "Cloud AI APIs (Google Gemini, Groq, OpenRouter, Mistral AI)",
        "Live execution latency & telemetry benchmarks"
      ]
    },
    {
      id: "compare",
      icon: GitCompare,
      title: "4. Compare Prompts",
      description: "Side-by-side prompt diffing and response evaluation with automated quality scoring and syntax variance detection.",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-100",
      route: "/app/compare",
      badge: "Side-by-Side Diff",
      details: "Inspect how prompt modifications change outputs. Compare two prompts side-by-side to detect instruction drifts, token density changes, and output formatting compliance.",
      highlights: [
        "Dual-pane prompt comparison",
        "Real-time character & token variance calculation",
        "Visual diff highlighting"
      ]
    },
    {
      id: "toolkit",
      icon: Wand2,
      title: "5. AI Toolkit",
      description: "Integrated utilities to generate, optimize, rewrite for specific LLM providers, translate, and score prompt health.",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-100",
      route: "/app/toolkit",
      badge: "AI Refactoring Suite",
      details: "Leverage smart prompt engineering utilities: auto-expand rough thoughts into structured system prompts, score anti-hallucination guardrails, and translate prompts into 7+ languages.",
      highlights: [
        "AI Prompt Generator & Optimizer",
        "5-Dimension Quality & Security Audit",
        "Multi-Language Prompt Translator"
      ]
    },
    {
      id: "analytics",
      icon: BarChart3,
      title: "6. Analytics & Telemetry",
      description: "Track version velocity, iteration cycles, model testing performance, and prompt domain usage across your projects.",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-100",
      route: "/app/analytics",
      badge: "Telemetry Dashboard",
      details: "Gain actionable visibility into prompt engineering velocity. Measure commit cadence, test pass rates, domain distributions, and model latency averages.",
      highlights: [
        "7d, 14d, and 30d commit trajectory charts",
        "Model latency & benchmark rankings",
        "Automated prompt health & quality index"
      ]
    }
  ];

  const steps = [
    {
      num: "01",
      title: "Create Prompt",
      desc: "Draft role definitions, system guidelines, and output constraints with live token tracking."
    },
    {
      num: "02",
      title: "Save and Organize",
      desc: "Categorize into private collections with custom tags, dialect filters, and searchable metadata."
    },
    {
      num: "03",
      title: "Create Versions",
      desc: "Commit iterative changes with descriptive commit logs, tracking every prompt modification."
    },
    {
      num: "04",
      title: "Test and Compare",
      desc: "Benchmark performance across simulated LLM models and compare variant outputs side-by-side."
    },
    {
      num: "05",
      title: "Improve Your Prompts",
      desc: "Refactor with AI toolkit assistance and lock in high-performing production-ready prompts."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navigation */}
      <nav className="w-full border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm text-white group-hover:bg-blue-700 transition">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-slate-900 group-hover:text-blue-600 transition">PromptCommit</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">PRIVATE</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition">Features</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition">How It Works</a>
            <a href="#security" className="hover:text-blue-600 transition">Security & Privacy</a>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/login"
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-16 pb-20 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Git-Inspired Version Control for AI Prompts</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight">
            Version Control for <span className="text-blue-600">AI Prompts.</span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Create, organize, test, compare, and manage your AI prompts in one private workspace.
            Track every iteration, commit meaningful changes, and roll back anytime.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => handleLaunch('/app')}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#features"
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-lg border border-slate-200 shadow-sm transition"
            >
              Explore Features
            </a>
          </div>

          {/* Clean Mock Card */}
          <div className="mt-14 max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-500">~/workspace/prompts/sql-generator.prompt</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="bg-blue-50 text-blue-700 font-mono font-medium px-2 py-0.5 rounded border border-blue-200">branch: main (v2.0)</span>
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">🔒 Private</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4">
              <div className="lg:col-span-4 space-y-2.5 font-mono text-xs">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center justify-between text-blue-800 font-bold">
                    <span>● v2.0 (HEAD)</span>
                    <span className="text-[10px] bg-blue-200 px-1.5 py-0.2 rounded text-blue-900">CURRENT</span>
                  </div>
                  <p className="text-slate-900 font-sans font-semibold mt-1 text-xs">Added few-shot examples</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Today at 10:30 AM • Aanshi Shah</p>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                  <div className="flex items-center justify-between text-slate-800 font-semibold">
                    <span>○ v1.2</span>
                    <span className="text-[10px] text-slate-500">Yesterday</span>
                  </div>
                  <p className="text-slate-700 font-sans text-xs mt-1">Improved instructions & CTEs</p>
                </div>
              </div>

              <div className="lg:col-span-8 bg-slate-900 rounded-lg p-4 font-mono text-xs leading-relaxed space-y-1 overflow-x-auto min-w-0 max-w-full text-slate-200">
                <div className="text-slate-400 text-[11px] mb-2 font-sans font-semibold uppercase tracking-wider">
                  Git Diff Inspector (v1.2 → v2.0)
                </div>
                <div className="text-slate-400">  You are a Staff Database Engineer specializing in SQL.</div>
                <div className="text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded">+ Requirements:</div>
                <div className="text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded">+ 1. Always analyze indexing considerations.</div>
                <div className="text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded">+ 2. Avoid nested subqueries where CTEs are cleaner.</div>
                <div className="text-slate-400">  Output format: valid markdown code blocks.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section id="features" className="py-20 border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Engineered for Prompt Precision
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Everything you need to author, iterate, test, and preserve high-value prompts with confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  onClick={() => setSelectedFeature(f)}
                  className="bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md rounded-xl p-6 shadow-sm flex flex-col justify-between transition-all duration-200 cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${f.bg} border group-hover:scale-105 transition-transform`}>
                        <Icon className={`w-5 h-5 ${f.color}`} />
                      </div>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {f.badge}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {f.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {f.description}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                    <span>Learn more & explore</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              How PromptCommit Works
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              From raw concept to battle-tested production prompt in five structured steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="text-2xl font-bold text-blue-600 font-mono mb-3">
                    {step.num}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1.5">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] font-medium text-slate-400">
                  Step {idx + 1} of 5
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Privacy Banner */}
      <section id="security" className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 text-center">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            100% Private by Design. No Public Leakage.
          </h2>
          <p className="text-slate-600 mt-3 text-sm max-w-xl mx-auto leading-relaxed">
            Your system prompts, domain knowledge, and proprietary workflows belong solely to your workspace.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-700 font-semibold">
            <span className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-1.5" /> Isolated User Vaults</span>
            <span className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-1.5" /> Local Persistence</span>
            <span className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-1.5" /> Zero Data Scrapes</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center space-x-2.5 group cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs group-hover:bg-blue-700 transition">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition">PromptCommit</div>
              <div className="text-[11px] text-slate-500">Private AI Prompt Testing Platform</div>
            </div>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-slate-600">
            <Link to="/login" className="hover:text-blue-600 transition">Sign In</Link>
            <Link to="/signup" className="hover:text-blue-600 transition">Create Account</Link>
            <Link to="/app" className="hover:text-blue-600 transition">Open Workspace</Link>
            <a href="mailto:support@promptcommit.dev" className="hover:text-blue-600 transition">Contact Support</a>
          </div>

          <div className="text-xs text-slate-400 text-center md:text-right">
            © {new Date().getFullYear()} PromptCommit. All rights reserved.
          </div>
        </div>
      </footer>

      {/* FEATURE DEEP-DIVE MODAL */}
      {selectedFeature && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedFeature(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${selectedFeature.bg} border shadow-sm`}>
                  {React.createElement(selectedFeature.icon, { className: `w-5 h-5 ${selectedFeature.color}` })}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {selectedFeature.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {selectedFeature.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFeature(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Deep-Dive Body */}
            <div className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed text-sm">
                {selectedFeature.details}
              </p>

              {/* Highlights Checklist */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Key Capabilities Included:
                </div>
                <div className="space-y-2">
                  {selectedFeature.highlights.map((h, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedFeature(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetRoute = selectedFeature.route;
                  setSelectedFeature(null);
                  handleLaunch(targetRoute);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Launch in Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
