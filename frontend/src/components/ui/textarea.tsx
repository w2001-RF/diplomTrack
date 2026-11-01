import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-xl px-3.5 py-2.5 text-sm border border-input bg-secondary/60 ring-offset-background placeholder:text-muted-foreground transition-[background-color,box-shadow,border-color] duration-200 hover:bg-secondary focus-visible:outline-none focus-visible:bg-background focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
