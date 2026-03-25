import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    type: "spring",
    stiffness: 500,
    damping: 30,
    mass: 0.8,
};
function ProductMock() {
    return (_jsx("div", { className: "product-frame", children: _jsxs("div", { className: "product-stage", children: [_jsxs("div", { className: "product-toolbar", children: [_jsxs("div", { className: "product-dots", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }), _jsx("span", { className: "apple-badge", children: "Live builder surface" })] }), _jsxs("div", { className: "product-stage__grid", children: [_jsxs("div", { className: "product-sidebar", children: [_jsx("p", { className: "apple-kicker", children: "Chat lane" }), _jsxs("div", { className: "section-stack", children: [_jsxs("div", { className: "apple-card", style: { padding: 14 }, children: [_jsx("p", { className: "apple-kicker", children: "Request" }), _jsx("p", { className: "apple-body", children: "Redesign the frontend in an Apple-style system without touching backend flows." })] }), _jsxs("div", { className: "product-pill-row", children: [_jsx("span", { className: "apple-badge apple-badge--muted", children: "/debug" }), _jsx("span", { className: "apple-badge apple-badge--muted", children: "/freeze" }), _jsx("span", { className: "apple-badge apple-badge--muted", children: "3 notes" })] }), _jsxs("div", { className: "apple-card", style: { padding: 14 }, children: [_jsx("p", { className: "apple-kicker", children: "Assistant" }), _jsx("p", { className: "apple-body", children: "Plan locked. Preview, diff, and runtime remain in the same frame." })] })] })] }), _jsxs("div", { className: "product-main", children: [_jsxs("div", { className: "product-pane", children: [_jsxs("div", { className: "product-window__top", children: [_jsx("p", { className: "apple-kicker", children: "Workspace" }), _jsx("span", { className: "apple-badge", children: "Preview attached" })] }), _jsxs("div", { className: "section-stack", children: [_jsx("div", { className: "product-line" }), _jsx("div", { className: "product-line", style: { width: "86%" } }), _jsx("div", { className: "product-line", style: { width: "72%" } }), _jsxs("div", { className: "apple-card", style: { padding: 16 }, children: [_jsx("p", { className: "apple-kicker", children: "Diff gate" }), _jsx("p", { className: "apple-body", children: "Changes are reviewed before write, not after surprise." })] })] })] }), _jsxs("div", { className: "apple-grid-2", children: [_jsxs("div", { className: "product-pane", children: [_jsxs("div", { className: "product-pane__top", children: [_jsx("p", { className: "apple-kicker", children: "Runtime" }), _jsx("span", { className: "apple-badge", children: "Connected" })] }), _jsxs("div", { className: "section-stack", children: [_jsx("div", { className: "product-line", style: { width: "84%" } }), _jsx("div", { className: "product-line", style: { width: "68%" } }), _jsx("div", { className: "product-line", style: { width: "76%" } })] })] }), _jsxs("div", { className: "product-pane", children: [_jsxs("div", { className: "product-pane__top", children: [_jsx("p", { className: "apple-kicker", children: "Session" }), _jsx("span", { className: "apple-badge", children: "Tracked" })] }), _jsxs("div", { className: "section-stack", children: [_jsxs("div", { className: "product-pill-row", children: [_jsx("span", { className: "apple-badge apple-badge--muted", children: "Keys" }), _jsx("span", { className: "apple-badge apple-badge--muted", children: "Sketch" })] }), _jsx("div", { className: "product-line", style: { width: "92%" } }), _jsx("div", { className: "product-line", style: { width: "60%" } })] })] })] })] })] })] }) }));
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
            if (mounted)
                setSession(Boolean(data.session));
        });
        const { data: { subscription }, } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(Boolean(next));
        });
        const handleKey = (event) => {
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
    return (_jsxs("div", { className: "apple-page intro-page", children: [showCounsel ? (_jsx("div", { className: "apple-modal-backdrop intro-egg", onClick: () => setShowCounsel(false), children: _jsxs("div", { className: "apple-modal intro-egg__card", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "brand-lockup", style: { justifyContent: "center" }, children: [_jsx("div", { className: "brand-lockup__mark", children: _jsx(KautilyaLogo, { size: 40 }) }), _jsxs("div", { children: [_jsx("p", { className: "brand-lockup__title", children: "Chanakya counsel" }), _jsx("p", { className: "brand-lockup__meta", children: "Press K or Escape to close" })] })] }), _jsxs("p", { className: "intro-egg__quote", children: ["\"", QUOTES[quoteIndex], "\""] })] }) })) : null, _jsx("div", { className: "intro-nav", children: _jsx("div", { className: "apple-shell", children: _jsxs("div", { className: "apple-surface intro-nav__inner", children: [_jsxs("div", { className: "brand-lockup", children: [_jsx("div", { className: "brand-lockup__mark", children: _jsx(KautilyaLogo, { size: 24 }) }), _jsxs("div", { children: [_jsx("p", { className: "brand-lockup__title", children: "Kautilya Code" }), _jsx("p", { className: "brand-lockup__meta", children: "Builder, runtime, and review in one surface" })] })] }), _jsxs("div", { className: "intro-nav__links", children: [_jsx("a", { href: "#story", children: "Story" }), _jsx("a", { href: "#workflow", children: "Workflow" }), _jsx("a", { href: "#proof", children: "Proof" }), _jsx("button", { className: "apple-btn", onClick: openPrimary, type: "button", children: primaryLabel })] })] }) }) }), _jsxs("div", { className: "apple-shell", children: [_jsxs("section", { className: "intro-hero", children: [_jsxs(motion.div, { animate: { opacity: 1, y: 0 }, initial: { opacity: 0, y: prefersReducedMotion ? 0 : 24 }, transition: prefersReducedMotion ? { duration: 0 } : springTransition, children: [_jsx("span", { className: "apple-badge", children: "Apple-style product redesign" }), _jsx("div", { style: { height: 20 } }), _jsx("h1", { className: "apple-heading", children: "One calm workspace for prompt, run, and review." }), _jsx("div", { style: { height: 20 } }), _jsx("p", { className: "apple-body", children: "Kautilya keeps the request, the files, the runtime, and the approval step inside one disciplined surface so trust comes before spectacle." }), _jsxs("div", { className: "intro-actions", children: [_jsx("button", { className: "apple-btn", onClick: openPrimary, type: "button", children: primaryLabel }), _jsx("button", { className: "apple-btn apple-btn--secondary", onClick: openSecondary, type: "button", children: secondaryLabel })] }), _jsxs("div", { className: "intro-meta", children: [_jsx("span", { className: "apple-badge apple-badge--muted", children: "Prompt stays visible" }), _jsx("span", { className: "apple-badge apple-badge--muted", children: "Preview in frame" }), _jsx("span", { className: "apple-badge apple-badge--muted", children: "Diff before write" })] }), _jsxs("p", { className: "brand-lockup__meta", style: { marginTop: 18 }, children: ["Press ", _jsx("strong", { children: "K" }), " for counsel. Public routes remain `/`, `/login`, `/dashboard`, and `/builder`."] })] }), _jsx(motion.div, { animate: { opacity: 1, y: 0 }, initial: { opacity: 0, y: prefersReducedMotion ? 0 : 28 }, transition: prefersReducedMotion
                                    ? { duration: 0 }
                                    : { ...springTransition, delay: 0.06 }, children: _jsx(ProductMock, {}) })] }), _jsxs("section", { className: "section-stack", id: "story", children: [_jsxs("div", { className: "section-block apple-card", children: [_jsx("p", { className: "apple-kicker", children: "Product story" }), _jsx("h2", { className: "apple-subheading", children: "Three moments explain the product faster than a long feature grid." }), _jsx("div", { style: { height: 14 } }), _jsx("p", { className: "apple-body", children: "The story stays simple: keep the request visible, keep the result visible, and keep approval visible." })] }), _jsx("div", { className: "story-grid", children: STORY_PANELS.map((panel, index) => (_jsxs(motion.article, { className: "apple-card story-card", initial: { opacity: 0, y: prefersReducedMotion ? 0 : 18 }, transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.35, delay: index * 0.05 }, viewport: { once: true, amount: 0.2 }, whileInView: { opacity: 1, y: 0 }, children: [_jsx("p", { className: "apple-kicker", children: panel.label }), _jsx("h3", { children: panel.title }), _jsx("p", { children: panel.body })] }, panel.title))) })] }), _jsxs("section", { className: "section-stack", id: "workflow", style: { marginTop: 18 }, children: [_jsxs("div", { className: "section-block apple-card", children: [_jsx("p", { className: "apple-kicker", children: "Workflow" }), _jsx("h2", { className: "apple-subheading", children: "A builder flow that makes the work feel legible." })] }), _jsx("div", { className: "workflow-list", children: WORKFLOW.map((step, index) => (_jsxs(motion.article, { className: "apple-card workflow-step", initial: { opacity: 0, y: prefersReducedMotion ? 0 : 18 }, transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.35, delay: index * 0.04 }, viewport: { once: true, amount: 0.2 }, whileInView: { opacity: 1, y: 0 }, children: [_jsxs("div", { className: "workflow-step__number", children: ["Step ", step.number] }), _jsx("h3", { children: step.title }), _jsx("p", { children: step.body })] }, step.number))) })] }), _jsxs("section", { className: "section-stack", id: "proof", style: { marginTop: 18 }, children: [_jsxs("div", { className: "section-block apple-card", children: [_jsx("p", { className: "apple-kicker", children: "Proof" }), _jsx("h2", { className: "apple-subheading", children: "Quiet evidence that the product already has substance." })] }), _jsx("div", { className: "proof-list", children: PROOF.map((item) => (_jsxs("article", { className: "apple-card proof-row", children: [_jsx("div", { className: "proof-row__tag", children: item.tag }), _jsxs("div", { children: [_jsx("h3", { style: { margin: 0, fontSize: "20px", letterSpacing: "-0.02em" }, children: item.title }), _jsx("p", { className: "apple-body", style: { marginTop: 8 }, children: item.body })] }), _jsx("span", { className: "apple-badge", children: item.state })] }, item.title))) })] }), _jsx("section", { className: "section-stack", style: { marginTop: 18 }, children: _jsxs("div", { className: "apple-card section-block vision-grid", children: [_jsxs("div", { children: [_jsx("p", { className: "apple-kicker", children: "Platform horizon" }), _jsx("h2", { className: "apple-subheading", children: "The value stays broad without inventing fake public routes." })] }), _jsx("div", { className: "vision-grid__items", children: VISION.map(([title, body]) => (_jsxs("article", { className: "apple-card vision-card", children: [_jsx("h3", { children: title }), _jsx("p", { children: body })] }, title))) })] }) }), _jsx("section", { style: { marginTop: 18, paddingBottom: 20 }, children: _jsxs(motion.div, { className: "apple-card section-block", initial: { opacity: 0, y: prefersReducedMotion ? 0 : 18 }, transition: prefersReducedMotion ? { duration: 0 } : springTransition, viewport: { once: true, amount: 0.3 }, whileInView: { opacity: 1, y: 0 }, children: [_jsxs("div", { className: "brand-lockup", children: [_jsx("div", { className: "brand-lockup__mark", children: _jsx(KautilyaLogo, { size: 28 }) }), _jsxs("div", { children: [_jsx("p", { className: "brand-lockup__title", children: "Refined product value" }), _jsx("p", { className: "brand-lockup__meta", children: "The app stays honest about what is already working." })] })] }), _jsx("div", { style: { height: 18 } }), _jsx("h2", { className: "apple-subheading", children: "Open the builder with the trust still intact." }), _jsx("div", { style: { height: 14 } }), _jsx("p", { className: "apple-body", children: "The redesigned frontend leads with clarity, defers to the real product, and keeps Kautilya\u2019s identity without drifting into noise." }), _jsxs("div", { className: "intro-actions", children: [_jsx("button", { className: "apple-btn", onClick: openPrimary, type: "button", children: primaryLabel }), _jsx("button", { className: "apple-btn apple-btn--ghost", onClick: openSecondary, type: "button", children: secondaryLabel })] })] }) })] })] }));
}
