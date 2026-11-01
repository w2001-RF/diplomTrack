import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';
  delay?: number;
}

// White card, colour only in the icon chip: one accent at a time
const chip: Record<NonNullable<StatsCardProps['variant']>, string> = {
  default: 'bg-secondary text-foreground',
  primary: 'bg-brand-blue/10 text-brand-blue dark:bg-primary/15 dark:text-primary',
  accent: 'bg-brand-crimson/10 text-brand-crimson',
  success: 'bg-status-validated/10 text-status-validated',
  warning: 'bg-status-pending/10 text-status-pending',
  danger: 'bg-status-rejected/10 text-status-rejected',
};

export function StatsCard({ title, value, subtitle, icon: Icon, trend, variant = 'default', delay = 0 }: StatsCardProps) {
  return (
    <Card
      className="animate-fade-in p-5 transition-shadow duration-300 hover:shadow-md"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
          <p className="text-[2rem] font-semibold leading-tight tracking-tight text-foreground tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trend.isPositive ? "text-status-validated" : "text-status-rejected"
            )}>
              <span>{trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground">vs. mois dernier</span>
            </div>
          )}
        </div>

        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", chip[variant])}>
          <Icon size={19} />
        </div>
      </div>
    </Card>
  );
}
