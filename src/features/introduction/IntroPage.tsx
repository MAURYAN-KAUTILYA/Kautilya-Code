import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import KautilyaLogo from "@/components/KautilyaLogo";
import { supabase } from "@/lib/supabaseClient";

const QUOTES = [
  "The wise act after weighing means, obstacles, time, and ground.",
  "Fear of failure should not command the plan.",
  "Trust grows when the work stays visible.",
];

const STORY_PANELS = [
  {
    label: "Request in frame",
    title: "Keep the brief visible while the work happens.",
    body: "Prompt, constraints, files, and response stay connected instead of being scattered across tools.",
  },
  {
    label: "Preview beside code",
    title: "Watch the result where you build it.",
    body: "Preview, runtime, and console feedback stay attached to the edit so decisions feel immediate.",
  },
  {
    label: "Approval before write",
    title: "Review changes with confidence.",
    body: "Diff approval remains part of the surface instead of becoming a hidden step after the fact.",
  },
];

const WORKFLOW = [
  {
    number: "01",
    title: "Frame the request",
    body: "Start from the task, the constraints, and the desired output so the builder never loses the reason it exists.",
  },
  {
    number: "02",
    title: "Inspect the actual files",
    body: "Open the project, navigate the workspace, and keep the source of truth in reach before making a decision.",
  },
  {
    number: "03",
    title: "Run, preview, and verify",
    body: "Execution feedback lives next to the draft so you can judge behavior without breaking context.",
  },
  {
    number: "04",
    title: "Approve before landing",
    body: "Review the diff, accept or reject it, and keep product trust at the center of the flow.",
  },
];

const PROOF = [
  {
    tag: "AUTH",
    title: "Protected routes are already live",
    body: "Guests move through login while signed-in users can reach the dashboard and builder without route changes.",
    state: "Live",
  },
  {
    tag: "BUILDER",
    title: "One builder surface already exists",
    body: "Chat, files, editor, preview, and runtime all live inside the same working frame.",
    state: "Shipped",
  },
  {
    tag: "REVIEW",
    title: "Diff approval is built into the experience",
    body: "Changes can be reviewed before they land, which makes the product feel intentional rather than opaque.",
    state: "Guarded",
  },
];

const VISION = [
  ["Builder", "The flagship workspace for prompt, code, preview, and review."],
  ["Dashboard", "A calm control surface for sessions, usage, and launch points."],
  ["API Wallet", "Bring-your-own model access without changing the product frame."],
  ["Session Memory", "Persistent commands, sketch notes, and resumable context."],
];

const springTransition = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
  mass: 0.8,
};

function ProductMock() {
  return (
    <div className="product-frame">
      <div className="product-stage">
        <div className="product-toolbar">
          <div className="product-dots">
            <span />
            <span />
            <span />
          </div>
          <span className="apple-badge">Live builder surface</span>
        </div>

        <div className="product-stage__grid">
          <div className="product-sidebar">
            <p className="apple-kicker">Chat lane</p>
            <div className="section-stack">
              <div className="apple-card" style={{ padding: 14 }}>
                <p className="apple-kicker">Request</p>
                <p className="apple-body">
                  Redesign the frontend in an Apple-style system without touching backend flows.
                </p>
              </div>
              <div className="product-pill-row">
                <span className="apple-badge apple-badge--muted">/debug</span>
                <span className="apple-badge apple-badge--muted">/freeze</span>
                <span className="apple-badge apple-badge--muted">3 notes</span>
              </div>
              <div className="apple-card" style={{ padding: 14 }}>
                <p className="apple-kicker">Assistant</p>
                <p className="apple-body">Plan locked. Preview, diff, and runtime remain in the same frame.</p>
              </div>
            </div>
          </div>

          <div className="product-main">
            <div className="product-pane">
              <div className="product-window__top">
                <p className="apple-kicker">Workspace</p>
                <span className="apple-badge">Preview attached</span>
              </div>
              <div className="section-stack">
                <div className="product-line" />
                <div className="product-line" style={{ width: "86%" }} />
                <div className="product-line" style={{ width: "72%" }} />
                <div className="apple-card" style={{ padding: 16 }}>
                  <p className="apple-kicker">Diff gate</p>
                  <p className="apple-body">Changes are reviewed before write, not after surprise.</p>
                </div>
              </div>
            </div>

            <div className="apple-grid-2">
              <div className="product-pane">
                <div className="product-pane__top">
                  <p className="apple-kicker">Runtime</p>
                  <span className="apple-badge">Connected</span>
                </div>
                <div className="section-stack">
                  <div className="product-line" style={{ width: "84%" }} />
                  <div className="product-line" style={{ width: "68%" }} />
                  <div className="product-line" style={{ width: "76%" }} />
                </div>
              </div>

              <div className="product-pane">
                <div className="product-pane__top">
                  <p className="apple-kicker">Session</p>
                  <span className="apple-badge">Tracked</span>
                </div>
                <div className="section-stack">
                  <div className="product-pill-row">
                    <span className="apple-badge apple-badge--muted">Keys</span>
                    <span className="apple-badge apple-badge--muted">Sketch</span>
                  </div>
                  <div className="product-line" style={{ width: "92%" }} />
                  <div className="product-line" style={{ width: "60%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntroPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [session, setSession] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [showCounsel, setShowCounsel] = useState(false);

  useEffect(() => {
    let mounted = true;
    const intervalId = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % QUOTES.length);
    }, 5000);

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(Boolean(next));
    });

    const handleKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && !event.ctrlKey && !event.metaKey) {
        setShowCounsel((current) => !current);
      }
      if (event.key === "Escape") {
        setShowCounsel(false);
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      subscription.unsubscribe();
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  const primaryLabel = session ? "Open dashboard" : "Continue to login";
  const secondaryLabel = session ? "Open builder" : "See the workflow";

  const openPrimary = () => navigate(session ? "/dashboard" : "/login");
  const openSecondary = () => {
    if (session) {
      navigate("/builder");
      return;
    }
    document.getElementById("workflow")?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <div className="apple-page intro-page">
      {showCounsel ? (
        <div className="apple-modal-backdrop intro-egg" onClick={() => setShowCounsel(false)}>
          <div
            className="apple-modal intro-egg__card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="brand-lockup" style={{ justifyContent: "center" }}>
              <div className="brand-lockup__mark">
                <KautilyaLogo size={40} />
              </div>
              <div>
                <p className="brand-lockup__title">Chanakya counsel</p>
                <p className="brand-lockup__meta">Press K or Escape to close</p>
              </div>
            </div>
            <p className="intro-egg__quote">"{QUOTES[quoteIndex]}"</p>
          </div>
        </div>
      ) : null}

      <div className="intro-nav">
        <div className="apple-shell">
          <div className="apple-surface intro-nav__inner">
            <div className="brand-lockup">
              <div className="brand-lockup__mark">
                <KautilyaLogo size={24} />
              </div>
              <div>
                <p className="brand-lockup__title">Kautilya Code</p>
                <p className="brand-lockup__meta">Builder, runtime, and review in one surface</p>
              </div>
            </div>

            <div className="intro-nav__links">
              <a href="#story">Story</a>
              <a href="#workflow">Workflow</a>
              <a href="#proof">Proof</a>
              <button className="apple-btn" onClick={openPrimary} type="button">
                {primaryLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="apple-shell">
        <section className="intro-hero">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
            transition={prefersReducedMotion ? { duration: 0 } : springTransition}
          >
            <span className="apple-badge">Apple-style product redesign</span>
            <div style={{ height: 20 }} />
            <h1 className="apple-heading">One calm workspace for prompt, run, and review.</h1>
            <div style={{ height: 20 }} />
            <p className="apple-body">
              Kautilya keeps the request, the files, the runtime, and the approval step inside one
              disciplined surface so trust comes before spectacle.
            </p>
            <div className="intro-actions">
              <button className="apple-btn" onClick={openPrimary} type="button">
                {primaryLabel}
              </button>
              <button className="apple-btn apple-btn--secondary" onClick={openSecondary} type="button">
                {secondaryLabel}
              </button>
            </div>
            <div className="intro-meta">
              <span className="apple-badge apple-badge--muted">Prompt stays visible</span>
              <span className="apple-badge apple-badge--muted">Preview in frame</span>
              <span className="apple-badge apple-badge--muted">Diff before write</span>
            </div>
            <p className="brand-lockup__meta" style={{ marginTop: 18 }}>
              Press <strong>K</strong> for counsel. Public routes remain `/`, `/login`, `/dashboard`,
              and `/builder`.
            </p>
          </motion.div>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 28 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { ...springTransition, delay: 0.06 }
            }
          >
            <ProductMock />
          </motion.div>
        </section>

        <section className="section-stack" id="story">
          <div className="section-block apple-card">
            <p className="apple-kicker">Product story</p>
            <h2 className="apple-subheading">Three moments explain the product faster than a long feature grid.</h2>
            <div style={{ height: 14 }} />
            <p className="apple-body">
              The story stays simple: keep the request visible, keep the result visible, and keep
              approval visible.
            </p>
          </div>

          <div className="story-grid">
            {STORY_PANELS.map((panel, index) => (
              <motion.article
                key={panel.title}
                className="apple-card story-card"
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, delay: index * 0.05 }}
                viewport={{ once: true, amount: 0.2 }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <p className="apple-kicker">{panel.label}</p>
                <h3>{panel.title}</h3>
                <p>{panel.body}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="section-stack" id="workflow" style={{ marginTop: 18 }}>
          <div className="section-block apple-card">
            <p className="apple-kicker">Workflow</p>
            <h2 className="apple-subheading">A builder flow that makes the work feel legible.</h2>
          </div>

          <div className="workflow-list">
            {WORKFLOW.map((step, index) => (
              <motion.article
                key={step.number}
                className="apple-card workflow-step"
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, delay: index * 0.04 }}
                viewport={{ once: true, amount: 0.2 }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <div className="workflow-step__number">Step {step.number}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="section-stack" id="proof" style={{ marginTop: 18 }}>
          <div className="section-block apple-card">
            <p className="apple-kicker">Proof</p>
            <h2 className="apple-subheading">Quiet evidence that the product already has substance.</h2>
          </div>

          <div className="proof-list">
            {PROOF.map((item) => (
              <article className="apple-card proof-row" key={item.title}>
                <div className="proof-row__tag">{item.tag}</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "20px", letterSpacing: "-0.02em" }}>{item.title}</h3>
                  <p className="apple-body" style={{ marginTop: 8 }}>
                    {item.body}
                  </p>
                </div>
                <span className="apple-badge">{item.state}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section-stack" style={{ marginTop: 18 }}>
          <div className="apple-card section-block vision-grid">
            <div>
              <p className="apple-kicker">Platform horizon</p>
              <h2 className="apple-subheading">The value stays broad without inventing fake public routes.</h2>
            </div>

            <div className="vision-grid__items">
              {VISION.map(([title, body]) => (
                <article className="apple-card vision-card" key={title}>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={{ marginTop: 18, paddingBottom: 20 }}>
          <motion.div
            className="apple-card section-block"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
            transition={prefersReducedMotion ? { duration: 0 } : springTransition}
            viewport={{ once: true, amount: 0.3 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div className="brand-lockup">
              <div className="brand-lockup__mark">
                <KautilyaLogo size={28} />
              </div>
              <div>
                <p className="brand-lockup__title">Refined product value</p>
                <p className="brand-lockup__meta">The app stays honest about what is already working.</p>
              </div>
            </div>

            <div style={{ height: 18 }} />
            <h2 className="apple-subheading">Open the builder with the trust still intact.</h2>
            <div style={{ height: 14 }} />
            <p className="apple-body">
              The redesigned frontend leads with clarity, defers to the real product, and keeps
              Kautilya’s identity without drifting into noise.
            </p>
            <div className="intro-actions">
              <button className="apple-btn" onClick={openPrimary} type="button">
                {primaryLabel}
              </button>
              <button className="apple-btn apple-btn--ghost" onClick={openSecondary} type="button">
                {secondaryLabel}
              </button>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
