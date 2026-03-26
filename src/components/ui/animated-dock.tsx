"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

export interface DockItemData {
  id: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export interface AnimatedDockProps {
  className?: string;
  items: DockItemData[];
  triggerIcon?: React.ReactNode;
}

interface DockItemProps {
  item: DockItemData;
  mouseX: MotionValue<number>;
}

function DockItem({ item, mouseX }: DockItemProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = React.useState(false);

  const distance = useTransform(mouseX, (value) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { left: 0, width: 0 };
    return value - bounds.left - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-170, 0, 170], [52, 92, 52]);
  const width = useSpring(widthSync, {
    mass: 0.16,
    stiffness: 230,
    damping: 20,
  });

  const iconScaleSync = useTransform(width, [52, 92], [1.05, 1.42]);
  const iconScale = useSpring(iconScaleSync, {
    mass: 0.16,
    stiffness: 230,
    damping: 20,
  });

  return (
    <motion.button
      ref={ref}
      aria-disabled={item.disabled ? "true" : undefined}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={(event) => {
        event.preventDefault();
      }}
      style={{
        width,
        background:
          "radial-gradient(circle at top, rgba(255,255,255,0.26), transparent 58%), linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%), var(--builder-glass-strong)",
        borderColor: "rgba(var(--accent-rgb), 0.16)",
        boxShadow: hovered
          ? "0 18px 34px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.24), 0 0 0 1px rgba(255,255,255,0.04)"
          : "0 12px 28px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px rgba(255,255,255,0.03)",
        backdropFilter: "blur(28px) saturate(210%)",
        WebkitBackdropFilter: "blur(28px) saturate(210%)",
      }}
      className={cn(
        "relative aspect-square h-14 rounded-full border transition-[box-shadow,opacity] duration-200",
        "flex items-center justify-center text-[var(--accent-strong)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]",
        item.disabled ? "opacity-90" : "",
        item.className,
      )}
      type="button"
    >
      <AnimatePresence>
        {hovered ? (
          <motion.span
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-3.5 py-2"
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 100%), var(--builder-inverse-panel)",
              borderColor: "var(--builder-inverse-border)",
              color: "var(--builder-inverse-text)",
              boxShadow: "0 14px 30px rgba(0,0,0,0.24)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="font-['SF_Mono','JetBrains_Mono',monospace] text-[10px] uppercase tracking-[0.12em]">
              {item.label}
            </span>
          </motion.span>
        ) : null}
      </AnimatePresence>

      <motion.span
        className="flex h-full w-full items-center justify-center"
        style={{ scale: iconScale }}
      >
        {item.icon}
      </motion.span>
    </motion.button>
  );
}

export function AnimatedDock({ className, items, triggerIcon }: AnimatedDockProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(Infinity);

  React.useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div
      className={cn("fixed bottom-5 left-1/2 z-[210] hidden -translate-x-1/2 lg:block", className)}
      ref={rootRef}
    >
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mx-auto flex h-[4.75rem] items-end gap-4 rounded-full border px-5 pb-3.5 pt-2.5"
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            key="dock-open"
            onMouseLeave={() => mouseX.set(Infinity)}
            onMouseMove={(event) => mouseX.set(event.clientX)}
            style={{
              background:
                "radial-gradient(circle at top, rgba(255,255,255,0.28), transparent 62%), linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%), var(--builder-glass-strong)",
              borderColor: "rgba(var(--accent-rgb), 0.14)",
              boxShadow:
                "0 24px 48px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.22), 0 0 0 1px rgba(255,255,255,0.05)",
              backdropFilter: "blur(40px) saturate(220%)",
              WebkitBackdropFilter: "blur(40px) saturate(220%)",
            }}
            transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.9 }}
          >
            <motion.button
              animate={{ opacity: 1, scale: 1 }}
              aria-expanded="true"
              aria-label="Close multitasking dock"
              className="grid h-14 w-14 place-items-center rounded-full border"
              initial={{ opacity: 0.9, scale: 0.96 }}
              onClick={() => setOpen(false)}
              style={{
                background:
                  "radial-gradient(circle at top, rgba(255,255,255,0.24), transparent 58%), linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.08) 100%), var(--builder-glass-strong)",
                borderColor: "rgba(var(--accent-rgb), 0.2)",
                color: "var(--accent-strong)",
                boxShadow: "0 12px 28px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.18)",
                backdropFilter: "blur(30px) saturate(210%)",
                WebkitBackdropFilter: "blur(30px) saturate(210%)",
              }}
              transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.9 }}
              type="button"
            >
              {triggerIcon}
            </motion.button>
            {items.map((item) => (
              <DockItem item={item} key={item.id} mouseX={mouseX} />
            ))}
          </motion.div>
        ) : (
          <motion.button
            animate={{ opacity: 1, y: 0, scale: 1 }}
            aria-expanded="false"
            aria-label="Open multitasking dock"
            className="grid h-14 w-14 place-items-center rounded-full border"
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            key="dock-closed"
            onClick={() => setOpen(true)}
            style={{
              background:
                "radial-gradient(circle at top, rgba(255,255,255,0.24), transparent 58%), linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.08) 100%), var(--builder-glass-strong)",
              borderColor: "rgba(var(--accent-rgb), 0.2)",
              color: "var(--accent-strong)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)",
              backdropFilter: "blur(30px) saturate(210%)",
              WebkitBackdropFilter: "blur(30px) saturate(210%)",
            }}
            transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.9 }}
            type="button"
          >
            {triggerIcon}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AnimatedDock;
