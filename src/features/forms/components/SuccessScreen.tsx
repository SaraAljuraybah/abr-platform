import { CircleCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

/**
 * Replaces a form after a successful submission. Focus moves to the title so screen readers
 * announce the result once.
 */
export function SuccessScreen({
  title,
  body,
  homeLabel,
}: {
  title: string;
  body: string;
  homeLabel: string;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-start">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-success-bg text-success"
      >
        <CircleCheck strokeWidth={1.75} className="size-6" />
      </span>
      <h1 ref={titleRef} tabIndex={-1} className="auth-title mt-5 text-brand outline-none">
        {title}
      </h1>
      <p className="mt-3 text-muted-foreground">{body}</p>
      <Button asChild variant="outline" className="mt-8">
        <Link to="/">{homeLabel}</Link>
      </Button>
    </div>
  );
}
