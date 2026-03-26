'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
const glassSurface = {
    background: 'radial-gradient(circle at top, rgba(255,255,255,0.22), transparent 66%), linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%), var(--builder-glass-strong)',
    border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: '0 14px 34px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.08)',
    backdropFilter: 'blur(30px) saturate(190%)',
    WebkitBackdropFilter: 'blur(30px) saturate(190%)',
};
const triggerStyle = {
    ...glassSurface,
    color: 'var(--accent-strong)',
};
const MacOSDock = ({ apps, onAppClick, openApps = [], className = '', }) => {
    const [mouseX, setMouseX] = useState(null);
    const [currentScales, setCurrentScales] = useState(apps.map(() => 1));
    const [currentPositions, setCurrentPositions] = useState([]);
    const [open, setOpen] = useState(false);
    const dockRef = useRef(null);
    const iconRefs = useRef([]);
    const animationFrameRef = useRef(undefined);
    const lastMouseMoveTime = useRef(0);
    const scaleStateRef = useRef(apps.map(() => 1));
    const positionStateRef = useRef([]);
    const getResponsiveConfig = useCallback(() => {
        if (typeof window === 'undefined') {
            return { baseIconSize: 48, maxScale: 1.52, effectWidth: 220 };
        }
        const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
        if (smallerDimension < 480) {
            return {
                baseIconSize: Math.max(34, smallerDimension * 0.068),
                maxScale: 1.32,
                effectWidth: smallerDimension * 0.28,
            };
        }
        if (smallerDimension < 768) {
            return {
                baseIconSize: Math.max(38, smallerDimension * 0.06),
                maxScale: 1.38,
                effectWidth: smallerDimension * 0.25,
            };
        }
        if (smallerDimension < 1024) {
            return {
                baseIconSize: Math.max(42, smallerDimension * 0.052),
                maxScale: 1.44,
                effectWidth: smallerDimension * 0.24,
            };
        }
        return {
            baseIconSize: Math.max(46, Math.min(54, smallerDimension * 0.038)),
            maxScale: 1.5,
            effectWidth: 220,
        };
    }, []);
    const [config, setConfig] = useState(getResponsiveConfig);
    const { baseIconSize, maxScale, effectWidth } = config;
    const minScale = 1;
    const baseSpacing = Math.max(3, baseIconSize * 0.06);
    useEffect(() => {
        const handleResize = () => setConfig(getResponsiveConfig());
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [getResponsiveConfig]);
    useEffect(() => {
        if (!open)
            return undefined;
        const handlePointerDown = (event) => {
            const target = event.target;
            if (target && dockRef.current?.contains(target))
                return;
            setOpen(false);
            setMouseX(null);
        };
        const handleEscape = (event) => {
            if (event.key !== 'Escape')
                return;
            setOpen(false);
            setMouseX(null);
        };
        window.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('keydown', handleEscape);
        return () => {
            window.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [open]);
    const calculateTargetMagnification = useCallback((mousePosition) => {
        if (mousePosition === null) {
            return apps.map(() => minScale);
        }
        return apps.map((_, index) => {
            const normalIconCenter = index * (baseIconSize + baseSpacing) + baseIconSize / 2;
            const minX = mousePosition - effectWidth / 2;
            const maxX = mousePosition + effectWidth / 2;
            if (normalIconCenter < minX || normalIconCenter > maxX) {
                return minScale;
            }
            const theta = ((normalIconCenter - minX) / effectWidth) * 2 * Math.PI;
            const clampedTheta = Math.min(Math.max(theta, 0), 2 * Math.PI);
            const scaleFactor = (1 - Math.cos(clampedTheta)) / 2;
            return minScale + scaleFactor * (maxScale - minScale);
        });
    }, [apps, baseIconSize, baseSpacing, effectWidth, maxScale]);
    const calculatePositions = useCallback((scales) => {
        let currentX = 0;
        return scales.map((scale) => {
            const scaledWidth = baseIconSize * scale;
            const centerX = currentX + scaledWidth / 2;
            currentX += scaledWidth + baseSpacing;
            return centerX;
        });
    }, [baseIconSize, baseSpacing]);
    useEffect(() => {
        const initialScales = apps.map(() => minScale);
        const initialPositions = calculatePositions(initialScales);
        scaleStateRef.current = initialScales;
        positionStateRef.current = initialPositions;
        setCurrentScales(initialScales);
        setCurrentPositions(initialPositions);
    }, [apps, calculatePositions, config]);
    const animateToTarget = useCallback(() => {
        if (!open)
            return;
        const targetScales = calculateTargetMagnification(mouseX);
        const targetPositions = calculatePositions(targetScales);
        const lerpFactor = mouseX !== null ? 0.2 : 0.12;
        let scalesNeedUpdate = false;
        let positionsNeedUpdate = false;
        const nextScales = scaleStateRef.current.map((currentScale, index) => {
            const nextScale = currentScale + (targetScales[index] - currentScale) * lerpFactor;
            if (Math.abs(nextScale - targetScales[index]) > 0.002)
                scalesNeedUpdate = true;
            return nextScale;
        });
        const nextPositions = positionStateRef.current.map((currentPosition, index) => {
            const nextPosition = currentPosition + (targetPositions[index] - currentPosition) * lerpFactor;
            if (Math.abs(nextPosition - targetPositions[index]) > 0.1)
                positionsNeedUpdate = true;
            return nextPosition;
        });
        scaleStateRef.current = nextScales;
        positionStateRef.current = nextPositions;
        setCurrentScales(nextScales);
        setCurrentPositions(nextPositions);
        if (scalesNeedUpdate || positionsNeedUpdate || mouseX !== null) {
            animationFrameRef.current = requestAnimationFrame(animateToTarget);
        }
    }, [calculatePositions, calculateTargetMagnification, mouseX, open]);
    useEffect(() => {
        if (!open) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            return undefined;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(animateToTarget);
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [animateToTarget, open]);
    const handleMouseMove = useCallback((event) => {
        const now = performance.now();
        if (now - lastMouseMoveTime.current < 16)
            return;
        lastMouseMoveTime.current = now;
        if (dockRef.current) {
            const rect = dockRef.current.getBoundingClientRect();
            const padding = Math.max(8, baseIconSize * 0.12);
            setMouseX(event.clientX - rect.left - padding);
        }
    }, [baseIconSize]);
    const handleMouseLeave = useCallback(() => {
        setMouseX(null);
    }, []);
    const createBounceAnimation = (element) => {
        const bounceHeight = Math.max(-7, -baseIconSize * 0.14);
        element.style.transition = 'transform 0.18s ease-out';
        element.style.transform = `translateY(${bounceHeight}px)`;
        setTimeout(() => {
            element.style.transform = 'translateY(0px)';
        }, 180);
    };
    const handleDockAppClick = (appId, index) => {
        if (iconRefs.current[index]) {
            createBounceAnimation(iconRefs.current[index]);
        }
        onAppClick(appId);
    };
    const contentWidth = currentPositions.length > 0
        ? Math.max(...currentPositions.map((position, index) => position + (baseIconSize * currentScales[index]) / 2))
        : apps.length * (baseIconSize + baseSpacing) - baseSpacing;
    const padding = Math.max(8, baseIconSize * 0.12);
    return (_jsx("div", { ref: dockRef, className: cn('select-none', className), children: _jsx(AnimatePresence, { mode: "wait", children: open ? (_jsx(motion.div, { initial: { opacity: 0, y: 12, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 10, scale: 0.98 }, transition: { type: 'spring', stiffness: 280, damping: 24, mass: 0.9 }, className: "backdrop-blur-md", onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave, style: {
                    ...glassSurface,
                    width: `${contentWidth + padding * 2}px`,
                    borderRadius: `${Math.max(18, baseIconSize * 0.34)}px`,
                    padding: `${padding}px`,
                }, children: _jsx("div", { className: "relative", style: {
                        height: `${baseIconSize}px`,
                        width: '100%',
                    }, children: apps.map((app, index) => {
                        const scale = currentScales[index] || 1;
                        const position = currentPositions[index] || 0;
                        const scaledSize = baseIconSize * scale;
                        const iconSize = Math.max(18, scaledSize * 0.44);
                        return (_jsx("button", { ref: (element) => {
                                iconRefs.current[index] = element;
                            }, type: "button", title: app.name, "aria-label": app.name, onClick: () => handleDockAppClick(app.id, index), className: "absolute flex items-end justify-center border-0 bg-transparent p-0", style: {
                                left: `${position - scaledSize / 2}px`,
                                bottom: '0px',
                                width: `${scaledSize}px`,
                                height: `${scaledSize}px`,
                                transformOrigin: 'bottom center',
                                zIndex: Math.round(scale * 10),
                            }, children: _jsxs("span", { className: "relative flex items-center justify-center rounded-[18px]", style: {
                                    width: `${Math.max(36, scaledSize * 0.82)}px`,
                                    height: `${Math.max(36, scaledSize * 0.82)}px`,
                                    background: 'radial-gradient(circle at top, rgba(255,255,255,0.16), transparent 62%), linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 100%), rgba(18,18,20,0.74)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: `0 ${Math.max(3, baseIconSize * 0.06)}px ${Math.max(10, baseIconSize * 0.2)}px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)`,
                                    color: 'rgba(255,255,255,0.96)',
                                }, children: [typeof app.icon === 'string' ? (_jsx("img", { src: app.icon, alt: app.name, width: iconSize, height: iconSize, className: "object-contain" })) : (_jsx("span", { style: {
                                            display: 'inline-flex',
                                            transform: `scale(${0.92 + (scale - 1) * 0.24})`,
                                        }, children: app.icon })), openApps.includes(app.id) ? (_jsx("span", { className: "absolute", style: {
                                            bottom: -3,
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            width: Math.max(3, baseIconSize * 0.06),
                                            height: Math.max(3, baseIconSize * 0.06),
                                            borderRadius: '999px',
                                            background: 'rgba(255,255,255,0.84)',
                                            boxShadow: '0 0 4px rgba(0,0,0,0.24)',
                                        } })) : null] }) }, app.id));
                    }) }) }, "dock-open")) : (_jsx(motion.button, { type: "button", "aria-label": "Open multitasking dock", onClick: () => setOpen(true), className: "grid h-16 w-16 place-items-center rounded-full", style: triggerStyle, initial: { opacity: 0, y: 10, scale: 0.94 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 10, scale: 0.94 }, transition: { type: 'spring', stiffness: 280, damping: 22, mass: 0.9 }, whileTap: { scale: 0.97 }, children: _jsx(ChevronUp, { size: 28, strokeWidth: 2.1 }) }, "dock-trigger")) }) }));
};
export default MacOSDock;
