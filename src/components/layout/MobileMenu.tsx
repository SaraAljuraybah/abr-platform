import { Menu, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { Button } from '@/components/ui/button';

/**
 * Disclosure menu for small screens (not a modal, so no focus trap).
 * Escape closes it and returns focus to the button; choosing a link, clicking outside
 * or navigating closes it too. Must sit inside a positioned (relative) header container.
 */
export function MobileMenu({ className, children }: { className?: string; children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Close when the route or hash changes (adjusting state during render, not in an effect).
  const { pathname, hash } = useLocation();
  const locationKey = `${pathname}${hash}`;
  const [lastLocationKey, setLastLocationKey] = useState(locationKey);
  if (locationKey !== lastLocationKey) {
    setLastLocationKey(locationKey);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onPanelClick(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest('a')) setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    panel?.addEventListener('click', onPanelClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      panel?.removeEventListener('click', onPanelClick);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={className}>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        {open ? (
          <X aria-hidden="true" strokeWidth={1.75} />
        ) : (
          <Menu aria-hidden="true" strokeWidth={1.75} />
        )}
        <span className="sr-only">{t('nav.menu')}</span>
      </Button>

      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-background px-6 py-4 shadow-md"
      >
        {children}
      </div>
    </div>
  );
}
