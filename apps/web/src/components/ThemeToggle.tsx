'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Icon, type IconName } from './Icon';
import { cn } from './ui';

export type ThemeChoice = 'light' | 'dark' | 'system';

const OPTIONS: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'Match device', icon: 'monitor' },
];

const EVENT = 'themechange';

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  try {
    if (choice === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', choice);
  } catch {
    // Private windows can block storage. The theme still changes for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Light, dark, or follow the device. The choice is remembered on this device. */
export function ThemeToggle({ className }: { className?: string }) {
  // The server cannot know the saved choice, so it renders "system" and the browser corrects it
  const choice = useSyncExternalStore(subscribe, readChoice, () => 'system' as ThemeChoice);

  // While following the device, switch live when the device switches
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => readChoice() === 'system' && applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return (
    <div role="radiogroup" aria-label="Theme" className={cn('inline-flex rounded-lg bg-sunken p-0.5', className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => applyTheme(o.value)}
          className={cn(
            'flex h-8 w-9 items-center justify-center rounded-md transition-colors',
            choice === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          <Icon name={o.icon} size={16} />
        </button>
      ))}
    </div>
  );
}
