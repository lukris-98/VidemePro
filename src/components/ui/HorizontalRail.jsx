import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function HorizontalRail({ children, className = "", contentClassName = "", step = 96, buttonClassName = "" }) {
  const railRef = useRef(null);
  const holdRef = useRef(null);
  const [scrollState, setScrollState] = useState({ canLeft: false, canRight: false });

  const updateScrollState = () => {
    const element = railRef.current;
    if (!element) return;
    setScrollState({
      canLeft: element.scrollLeft > 2,
      canRight: element.scrollLeft + element.clientWidth < element.scrollWidth - 2
    });
  };

  const scroll = (direction, amount = step, smooth = true) => {
    const element = railRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * amount, behavior: smooth ? "smooth" : "auto" });
  };

  const stopHold = () => {
    if (holdRef.current) {
      window.clearInterval(holdRef.current);
      holdRef.current = null;
    }
  };

  const startHold = (direction) => {
    stopHold();
    holdRef.current = window.setInterval(() => {
      const element = railRef.current;
      if (!element) {
        stopHold();
        return;
      }
      const atLeft = element.scrollLeft <= 2;
      const atRight = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
      if ((direction < 0 && atLeft) || (direction > 0 && atRight)) {
        stopHold();
        updateScrollState();
        return;
      }
      scroll(direction, 18, false);
    }, 24);
  };

  useEffect(() => {
    updateScrollState();
    const element = railRef.current;
    if (!element) return undefined;
    element.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);
    return () => {
      stopHold();
      element.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`}>
      {scrollState.canLeft ? (
        <RailButton
          direction="left"
          className={buttonClassName}
          onClick={() => scroll(-1)}
          onHoldStart={() => startHold(-1)}
          onHoldStop={stopHold}
        />
      ) : null}
      <div ref={railRef} className={`no-scrollbar min-w-0 flex-1 overflow-x-auto scroll-smooth ${contentClassName}`}>
        {children}
      </div>
      {scrollState.canRight ? (
        <RailButton
          direction="right"
          className={buttonClassName}
          onClick={() => scroll(1)}
          onHoldStart={() => startHold(1)}
          onHoldStop={stopHold}
        />
      ) : null}
    </div>
  );
}

function RailButton({ direction, className, onClick, onHoldStart, onHoldStop }) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      title={direction === "left" ? "Geser kiri" : "Geser kanan"}
      onClick={onClick}
      onPointerDown={onHoldStart}
      onPointerUp={onHoldStop}
      onPointerCancel={onHoldStop}
      onPointerLeave={onHoldStop}
      className={`grid h-8 w-5 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[#111] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white ${className}`}
    >
      <Icon size={14} />
    </button>
  );
}
