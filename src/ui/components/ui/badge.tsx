import React from "react";
import { cn } from "./utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const variantStyles: Record<string, string> = {
  default: "bg-neutral-900 text-white border-transparent",
  secondary: "bg-neutral-100 text-neutral-700 border-transparent",
  destructive: "bg-red-500 text-white border-transparent",
  outline: "text-neutral-900 border-neutral-200",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 [&>svg]:size-3",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
