import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

/** What a form may tell the user about a failed submission. */
export type FormErrorKind = 'rateLimited' | 'network' | 'unexpected';

export class FormFailure extends Error {
  constructor(readonly kind: FormErrorKind) {
    super(kind);
    this.name = 'FormFailure';
  }
}

/** Maps an Edge Function error by status, never by message text. */
export function toFormFailure(error: unknown): FormFailure {
  if (error instanceof FormFailure) return error;
  if (error instanceof FunctionsHttpError) {
    const status = (error.context as Response | undefined)?.status;
    if (status === 429) return new FormFailure('rateLimited');
    console.error('Form submission refused', { status });
    return new FormFailure('unexpected');
  }
  // No answer at all: offline, DNS, CORS refusal or the function unreachable.
  if (error instanceof FunctionsFetchError || error instanceof TypeError) {
    return new FormFailure('network');
  }
  console.error('Unexpected form error', error instanceof Error ? error.name : error);
  return new FormFailure('unexpected');
}
