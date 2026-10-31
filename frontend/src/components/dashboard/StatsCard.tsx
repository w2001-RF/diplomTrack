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

export function StatsCard({ title, value, subtitle, icon: Icon, trend, variant = 'default', delay = 0 }: StatsCardProps) {
  return (
    <Card 
      className={cn(
        "p-6 animate-fade-in transition-all duration-200 hover:shadow-md",
        variant === 'primary' && "border-primary/20 bg-primary/5",
        variant === 'accent' && "border-accent/20 bg-accent/5",
        variant === 'success' && "border-status-validated/20 bg-status-validated/5",
        variant === 'warning' && "border-status-pending/20 bg-status-pending/5",
        variant === 'danger' && "border-status-rejected/20 bg-status-rejected/5"
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
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
        
        <div className={cn(
          "flex items-center justify-center w-12 h-12 rounded-xl",
          variant === 'default' && "bg-secondary text-secondary-foreground",
          variant === 'primary' && "bg-primary/10 text-primary",
          variant === 'accent' && "bg-accent/10 text-accent",
          variant === 'success' && "bg-status-validated/10 text-status-validated",
          variant === 'warning' && "bg-status-pending/10 text-status-pending",
          variant === 'danger' && "bg-status-rejected/10 text-status-rejected"
        )}>
          <Icon size={24} />
        </div>
      </div>
    </Card>
  );
}
