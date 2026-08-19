import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "destructive" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const variantClasses = {
  default:
    "bg-slate-900/90 text-white shadow-sm hover:bg-slate-800 hover:shadow-md active:scale-[0.98]",
  secondary:
    "glass-panel text-slate-900 hover:bg-white/75 active:scale-[0.98]",
  destructive:
    "bg-red-600/95 text-white shadow-sm hover:bg-red-700 active:scale-[0.98]",
  ghost:
    "text-slate-700 hover:bg-white/50 active:scale-[0.98]",
  outline:
    "border border-white/60 bg-white/40 text-slate-700 backdrop-blur-sm hover:bg-white/60 active:scale-[0.98]",
};

const sizeClasses = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-6 text-base",
  icon: "h-9 w-9",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {children}
          </span>
        ) : children}
      </button>
    );
  }
);
Button.displayName = "Button";
