"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
        <div
          className={cn(
            "glass-panel relative z-10 w-full max-w-lg p-6 animate-fade-in-up",
            "max-h-[calc(100vh-2rem)] overflow-y-auto",
            className
          )}
          role="dialog"
          aria-modal
          aria-labelledby={title ? "dialog-title" : undefined}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              {title && (
                <h2 id="dialog-title" className="text-lg font-semibold text-slate-900">
                  {title}
                </h2>
              )}
              {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="ml-4 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
