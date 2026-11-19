import { cn } from './ui';

/** The DeeClinic mark: a soft rounded tile with a leaf-like petal, in the brand teal and rose. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="relative inline-flex shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm"
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <path d="M12 3c4.6 2.6 7 6.2 7 10a7 7 0 0 1-14 0c0-3.8 2.4-7.4 7-10z" fill="currentColor" fillOpacity="0.28" />
        <path d="M12 3c4.6 2.6 7 6.2 7 10a7 7 0 0 1-14 0c0-3.8 2.4-7.4 7-10zM12 8v13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
    </span>
  );
}

export function Brand({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-fg">DeeClinic</span>
        {subtitle && <span className="block text-xs text-muted">Clinic manager</span>}
      </span>
    </span>
  );
}
