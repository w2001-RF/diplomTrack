import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-border text-foreground",
        pending: "bg-status-pending/15 text-status-pending border border-status-pending/30",
        "in-progress": "bg-status-in-progress/15 text-status-in-progress border border-status-in-progress/30",
        validated: "bg-status-validated/15 text-status-validated border border-status-validated/30",
        rejected: "bg-status-rejected/15 text-status-rejected border border-status-rejected/30",
        blocked: "bg-status-blocked/15 text-status-blocked border border-status-blocked/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
