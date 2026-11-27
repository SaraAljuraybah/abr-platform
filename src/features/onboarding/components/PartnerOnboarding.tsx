import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { Controller, type Resolver, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CheckboxField } from '@/components/ui/checkbox-group';
import { ToggleChips } from '@/components/ui/chip-input';
import { CharacterCount } from '@/components/ui/field-number';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { TextareaField } from '@/components/ui/textarea-field';
import { toastStore } from '@/components/ui/toast-store';
import { optionItems } from '@/features/forms/options';
import { validationMessage } from '@/lib/zod-i18n';
import {
  EXPERTISE,
  ORG_SECTORS,
  ORG_SIZES,
  PARTNER_LIMITS as L,
  partnerSchemas,
  type PartnerRole,
  type PartnerValues,
  SUPPORT_TYPES,
  useSavePartner,
} from '../partner';

interface Props {
  userId: string;
  role: PartnerRole;
  values: PartnerValues;
  /** onboarding: finishing marks onboarding complete and opens /app. edit: saves in place. */
  mode: 'onboarding' | 'edit';
  /** Called after a successful save in edit mode. */
  onSaved?: () => void;
}

/**
 * One form for an organization or a mentor, in numbered sections. UX only: column grants, the
 * option-code CHECKs and the completion trigger decide what is stored.
 */
export function PartnerOnboarding({ userId, role, values, mode, onSaved }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const save = useSavePartner(userId);
  const errorRef = useRef<HTMLDivElement>(null);
  const form = useForm<PartnerValues>({
    resolver: zodResolver(partnerSchemas[role]) as unknown as Resolver<PartnerValues>,
    defaultValues: values,
  });
  const [fullName, organizationName, description, linkedinUrl] = useWatch({
    control: form.control,
    name: ['fullName', 'organizationName', 'description', 'linkedinUrl'],
  });

  useEffect(() => {
    if (save.error) errorRef.current?.focus();
  }, [save.error]);

  const fieldError = (name: keyof PartnerValues) => {
    const error = form.formState.errors[name];
    const message = Array.isArray(error) ? undefined : error?.message;
    return validationMessage(t, message);
  };
  const placeholder = <option value="">{t('onboarding.select')}</option>;
  const p = `onboarding.partner.${role}` as const;
  const chipsError = fieldError(role === 'organization' ? 'supportTypes' : 'expertise');

  const onSubmit = form.handleSubmit((submitted) => {
    save.mutate(
      { role, values: submitted, finish: mode === 'onboarding' },
      {
        onSuccess: () => {
          if (mode === 'onboarding') {
            toastStore.show(t('onboarding.partner.submitted'));
            void navigate('/app', { replace: true });
          } else {
            toastStore.show(t('onboarding.partner.saved'));
            onSaved?.();
          }
        },
      },
    );
  });

  const section = (n: number, title: string, children: React.ReactNode) => (
    <fieldset className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
      <legend className="sr-only">{title}</legend>
      <h2 aria-hidden="true" className="flex items-center gap-3 text-xl font-bold text-brand">
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-sm text-primary">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </fieldset>
  );

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-6">
      {save.error && (
        <Callout ref={errorRef} tabIndex={-1} variant="error">
          <p>{t(`onboarding.errors.${save.error.kind}`)}</p>
        </Callout>
      )}

      {section(
        1,
        t(`${p}.aboutTitle`),
        <>
          <TextField
            label={t(`${p}.fullName`)}
            autoComplete="name"
            maxLength={L.fullName.max}
            error={fieldError('fullName')}
            details={<CharacterCount value={fullName.length} max={L.fullName.max} />}
            {...form.register('fullName')}
          />
          {role === 'organization' ? (
            <>
              <TextField
                label={t('onboarding.partner.organization.organizationName')}
                autoComplete="organization"
                maxLength={L.organizationName.max}
                error={fieldError('organizationName')}
                details={
                  <CharacterCount value={organizationName.length} max={L.organizationName.max} />
                }
                {...form.register('organizationName')}
              />
              <SelectField
                label={t('onboarding.partner.organization.sector')}
                error={fieldError('sector')}
                {...form.register('sector')}
              >
                {placeholder}
                {optionItems(t, 'forms.interest.options.sector', ORG_SECTORS).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={t('onboarding.partner.organization.orgSize')}
                error={fieldError('orgSize')}
                {...form.register('orgSize')}
              >
                <option value="">{t('onboarding.partner.optional')}</option>
                {optionItems(t, 'forms.interest.options.org_size', ORG_SIZES).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={t('onboarding.partner.organization.website')}
                hint={t('onboarding.partner.organization.websiteHint')}
                type="url"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                dir="ltr"
                placeholder="https://example.com"
                error={fieldError('website')}
                {...form.register('website')}
              />
            </>
          ) : (
            <>
              <TextField
                label={t('onboarding.partner.mentor.jobTitle')}
                autoComplete="organization-title"
                maxLength={L.jobTitle.max}
                error={fieldError('jobTitle')}
                {...form.register('jobTitle')}
              />
              <TextField
                label={t('onboarding.partner.mentor.company')}
                autoComplete="organization"
                maxLength={L.company.max}
                error={fieldError('company')}
                {...form.register('company')}
              />
              <TextField
                label={t('onboarding.partner.mentor.years')}
                inputMode="numeric"
                dir="ltr"
                maxLength={2}
                error={fieldError('yearsOfExperience')}
                {...form.register('yearsOfExperience')}
              />
            </>
          )}
        </>,
      )}

      {section(
        2,
        t(`${p}.offerTitle`),
        <>
          <Controller
            control={form.control}
            name={role === 'organization' ? 'supportTypes' : 'expertise'}
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <ToggleChips
                  label={t(`${p}.chips`)}
                  hint={t('onboarding.partner.chooseAll')}
                  options={
                    role === 'organization'
                      ? optionItems(t, 'forms.interest.options.looking_for', SUPPORT_TYPES)
                      : optionItems(t, 'forms.interest.options.expertise', EXPERTISE)
                  }
                  value={field.value}
                  onChange={field.onChange}
                />
                {chipsError && (
                  <p className="text-sm font-medium text-error" role="alert">
                    {chipsError}
                  </p>
                )}
              </div>
            )}
          />
          <TextareaField
            label={t(`${p}.description`)}
            hint={t(`${p}.descriptionHint`)}
            maxLength={L.description.max}
            error={fieldError('description')}
            details={<CharacterCount value={description.length} max={L.description.max} />}
            {...form.register('description')}
          />
        </>,
      )}

      {section(
        3,
        t('onboarding.partner.contactTitle'),
        <>
          <p className="text-sm text-muted-foreground">{t('onboarding.partner.contactIntro')}</p>
          <TextField
            label={t('onboarding.about.phone')}
            hint={t('onboarding.partner.phoneHint')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="05XXXXXXXX"
            error={fieldError('phone')}
            {...form.register('phone')}
          />
          <CheckboxField
            label={t('onboarding.partner.sharePhone')}
            {...form.register('sharePhone')}
          />
          <TextField
            label={t('onboarding.partner.linkedin')}
            hint={t('onboarding.partner.linkedinHint')}
            type="url"
            inputMode="url"
            spellCheck={false}
            dir="ltr"
            placeholder="https://www.linkedin.com/in/username"
            error={fieldError('linkedinUrl')}
            {...form.register('linkedinUrl')}
          />
          {linkedinUrl.trim() !== '' && (
            <CheckboxField
              label={t('onboarding.partner.shareLinkedin')}
              {...form.register('shareLinkedin')}
            />
          )}
        </>,
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {mode === 'onboarding' ? t('onboarding.partner.reviewNote') : null}
        </p>
        <Button type="submit" loading={save.isPending} loadingText={t('onboarding.saving')}>
          {mode === 'onboarding' ? t('onboarding.partner.submit') : t('onboarding.partner.save')}
        </Button>
      </div>
    </form>
  );
}
