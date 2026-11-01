// DiplomTrack brand: a khatam (eight-pointed zellige star) mark in UIT blue with a
// crimson heart, and the name lockup with the university's Arabic name.

import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  /** On dark brand surfaces the tile is white and the star blue */
  inverted?: boolean;
}

export function BrandMark({ className, inverted = false }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-label="DiplomTrack" className={cn('h-10 w-10 shrink-0', className)}>
      <rect width="40" height="40" rx="11" className={inverted ? 'fill-white' : 'fill-brand-blue'} />
      {/* Two overlapping squares make the khatam */}
      <g className={inverted ? 'fill-brand-blue' : 'fill-white'}>
        <rect x="11" y="11" width="18" height="18" rx="1.5" />
        <rect x="11" y="11" width="18" height="18" rx="1.5" transform="rotate(45 20 20)" />
      </g>
      <circle cx="20" cy="20" r="4.2" className="fill-brand-crimson" />
    </svg>
  );
}

interface BrandLockupProps {
  className?: string;
  inverted?: boolean;
  /** Second line under the product name */
  subtitle?: string;
  showArabic?: boolean;
}

export function BrandLockup({ className, inverted = false, subtitle = 'Université Ibn Tofaïl · Kénitra', showArabic = false }: BrandLockupProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark inverted={inverted} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className={cn('text-[15px] font-semibold tracking-tight', inverted ? 'text-white' : 'text-foreground')}>
          DiplomTrack
        </span>
        <span className={cn('truncate text-xs', inverted ? 'text-white/60' : 'text-muted-foreground')}>{subtitle}</span>
        {showArabic && (
          <span lang="ar" dir="rtl" className={cn('mt-0.5 text-xs', inverted ? 'text-white/50' : 'text-muted-foreground')}>
            جامعة ابن طفيل · القنيطرة
          </span>
        )}
      </div>
    </div>
  );
}

/** Night-navy brand surface with a faint zellige lattice and a crimson glow */
export function ZelligePanel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('relative isolate overflow-hidden gradient-primary text-white', className)}>
      <div aria-hidden className="bg-zellige pointer-events-none absolute inset-0 -z-10 opacity-[0.07]" />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 -z-10 h-96 w-96 rounded-full bg-brand-crimson/30 blur-3xl"
      />
      {children}
    </div>
  );
}

/** A tall Moroccan arch (bab), used as a window onto the brand surface */
export function ArchWindow({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ borderRadius: '50% 50% 1.25rem 1.25rem / 34% 34% 1.25rem 1.25rem' }}
    >
      {children}
    </div>
  );
}
