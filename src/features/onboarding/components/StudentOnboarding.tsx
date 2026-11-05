import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { type Resolver, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Stepper } from '@/components/ui/stepper';
import { toastStore } from '@/components/ui/toast-store';
import { useSaveStep, type OnboardingData } from '../api';
import { ONBOARDING_STEPS } from '../options';
import { type OnboardingValues, stepSchemas } from '../schemas';
import { AboutStep, LinksStep, SkillsStep, StudiesStep } from './StepFields';

const LAST = ONBOARDING_STEPS.length - 1;

/**
 * The four student steps over one form state, so Back keeps everything. Next validates only the
 * current step, saves it, then moves on; a refresh resumes at the first step not yet completed.
 * The step heading takes focus on every step change, so the new step is read once.
 */
export function StudentOnboarding({ userId, data }: { userId: string; data: OnboardingData }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const save = useSaveStep(userId);
  const [index, setIndex] = useState(() => Math.min(data.completedSteps, LAST));
  const [progress, setProgress] = useState(data.completedSteps);
  // Read by the resolver at submit time, after this render's effects have run.
  const stepRef = useRef(index);
  useEffect(() => {
    stepRef.current = index;
  }, [index]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const errorRef = useRef<HTMLDivElement>(null);

  // Validates only the current step's fields; handleSubmit then reads the whole state.
  const resolver: Resolver<OnboardingValues> = (values, context, options) =>
    zodResolver(stepSchemas[ONBOARDING_STEPS[stepRef.current] ?? 'about'])(
      values,
      context,
      options as never,
    ) as ReturnType<Resolver<OnboardingValues>>;

  const form = useForm<OnboardingValues>({ resolver, defaultValues: data.values });

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  useEffect(() => {
    if (save.error) errorRef.current?.focus();
  }, [save.error]);

  const step = ONBOARDING_STEPS[index] ?? 'about';
  const finish = index === LAST;
  const names = ONBOARDING_STEPS.map((name) => t(`onboarding.steps.${name}`));

  const onSubmit = form.handleSubmit(() => {
    const nextProgress = Math.max(progress, index + 1);
    save.mutate(
      { step, progress: nextProgress, values: form.getValues(), finish },
      {
        onSuccess: () => {
          setProgress(nextProgress);
          if (finish) {
            toastStore.show(t('onboarding.done'));
            void navigate('/app', { replace: true });
          } else {
            setIndex(index + 1);
          }
        },
      },
    );
  });

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={names} current={index} label={t('onboarding.stepperLabel')} />

      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"
      >
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-brand outline-none">
            <span className="sr-only">
              {t('stepper.position', { current: index + 1, total: ONBOARDING_STEPS.length })}{' '}
            </span>
            {names[index]}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t(`onboarding.${step}.intro`)}</p>
        </div>

        {save.error && (
          <Callout ref={errorRef} tabIndex={-1} variant="error">
            <p>{t(`onboarding.errors.${save.error.kind}`)}</p>
          </Callout>
        )}

        {step === 'about' && <AboutStep form={form} universityName={data.universityName} />}
        {step === 'studies' && <StudiesStep form={form} />}
        {step === 'skills' && <SkillsStep form={form} />}
        {step === 'links' && <LinksStep form={form} />}

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
          {index > 0 ? (
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => {
                save.reset();
                form.clearErrors();
                setIndex(index - 1);
              }}
            >
              {t('onboarding.back')}
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
          <Button type="submit" loading={save.isPending} loadingText={t('onboarding.saving')}>
            {finish ? t('onboarding.finish') : t('onboarding.next')}
          </Button>
        </div>
      </form>
    </div>
  );
}
