import { zodResolver } from '@hookform/resolvers/zod';
import {
  INTEREST_LIMITS,
  INTEREST_OPTIONS,
  type InterestOptionKey,
} from '@shared/interest-options';
import { useState } from 'react';
import { Controller, type Resolver, useForm, useWatch } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CheckboxField, CheckboxGroup } from '@/components/ui/checkbox-group';
import { ChoiceGroup } from '@/components/ui/choice-group';
import { CharacterCount, NumberedLabel } from '@/components/ui/field-number';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useUniversities } from '@/features/auth/api';
import { useDirection } from '@/hooks/useDirection';
import { validationMessage } from '@/lib/zod-i18n';
import { FormShell } from '../components/FormShell';
import { PrivacyLink } from '../components/PrivacyLink';
import { RoleCards } from '../components/RoleCards';
import { type FormRole, roleFromParam } from '../roles';
import { SuccessScreen } from '../components/SuccessScreen';
import { optionItems } from '../options';
import { useSubmitInterest } from './api';
import {
  type InterestFormValues,
  interestDefaults,
  interestSchema,
  type InterestValues,
  payloadFor,
  toSubmission,
  UNIVERSITY_NOT_LISTED,
} from './schema';

type FieldKey =
  | 'fullName'
  | 'email'
  | 'universityId'
  | 'universityOther'
  | 'fieldOfStudy'
  | 'graduationYear'
  | 'projectStage'
  | 'organizationName'
  | 'sector'
  | 'lookingFor'
  | 'orgSize'
  | 'expertise'
  | 'experience'
  | 'region'
  | 'channel';

/** The numbered fields per role, in order (the free-text university only when chosen). */
function visibleFields(role: FormRole, universityId: string): FieldKey[] {
  const roleFields: Record<FormRole, FieldKey[]> = {
    student: [
      'universityId',
      ...(universityId === UNIVERSITY_NOT_LISTED ? (['universityOther'] as const) : []),
      'fieldOfStudy',
      'graduationYear',
      'projectStage',
    ],
    organization: ['organizationName', 'sector', 'lookingFor', 'orgSize'],
    mentor: ['expertise', 'experience'],
  };
  return ['fullName', 'email', ...roleFields[role], 'region', 'channel'];
}

const OPTIONS_PREFIX = 'forms.interest.options';

export function InterestForm() {
  const { t } = useTranslation();
  const { language, direction } = useDirection();
  const [params] = useSearchParams();
  const universities = useUniversities(language);
  const submit = useSubmitInterest();
  const [done, setDone] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<InterestFormValues, unknown, InterestValues>({
    // The schema is a union per role; the form keeps every role's fields in one flat state.
    resolver: zodResolver(interestSchema) as unknown as Resolver<
      InterestFormValues,
      unknown,
      InterestValues
    >,
    defaultValues: interestDefaults(roleFromParam(params.get('role'))),
  });

  const [role, universityId, fullName, organizationName, universityOther] = useWatch({
    control,
    name: ['role', 'universityId', 'fullName', 'organizationName', 'universityOther'],
  });

  const fieldError = (message: string | undefined) => validationMessage(t, message);
  const items = (key: InterestOptionKey) =>
    optionItems(t, `${OPTIONS_PREFIX}.${key}`, INTEREST_OPTIONS[key]);

  const onSubmit = handleSubmit(async (values) => {
    submit.reset();
    // Spam trap: the normal success and no request at all.
    if (getValues('website')) {
      setDone(true);
      return;
    }
    try {
      await submit.mutateAsync(payloadFor(toSubmission(values, language)));
    } catch {
      return; // submit.error drives the message.
    }
    setDone(true);
  });

  if (done) {
    return (
      <SuccessScreen
        title={t('forms.interest.success.title')}
        body={t('forms.interest.success.body')}
        homeLabel={t('forms.interest.success.home')}
      />
    );
  }

  const select = (
    key: 'fieldOfStudy' | 'sector' | 'expertise' | 'region' | 'channel',
    option: InterestOptionKey,
    n: number,
  ) => (
    <SelectField
      key={key}
      label={<NumberedLabel n={n}>{t(`forms.interest.${key}`)}</NumberedLabel>}
      error={fieldError(errors[key]?.message)}
      {...register(key)}
    >
      <option value="">{t('forms.common.selectPlaceholder')}</option>
      {items(option).map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </SelectField>
  );

  const choice = (
    key: 'graduationYear' | 'projectStage' | 'orgSize' | 'experience',
    option: InterestOptionKey,
    n: number,
  ) => (
    <Controller
      key={key}
      control={control}
      name={key}
      render={({ field }) => (
        <ChoiceGroup
          ref={field.ref}
          label={<NumberedLabel n={n}>{t(`forms.interest.${key}`)}</NumberedLabel>}
          options={items(option)}
          value={field.value}
          onValueChange={field.onChange}
          dir={direction}
          error={fieldError(errors[key]?.message)}
        />
      )}
    />
  );

  function renderField(key: FieldKey, n: number) {
    switch (key) {
      case 'fullName':
        return (
          <TextField
            key={key}
            label={<NumberedLabel n={n}>{t('forms.interest.fullName')}</NumberedLabel>}
            autoComplete="name"
            maxLength={INTEREST_LIMITS.fullName.max}
            error={fieldError(errors.fullName?.message)}
            details={<CharacterCount value={fullName.length} max={INTEREST_LIMITS.fullName.max} />}
            {...register('fullName')}
          />
        );
      case 'email':
        return (
          <TextField
            key={key}
            label={<NumberedLabel n={n}>{t('forms.interest.email')}</NumberedLabel>}
            hint={t('forms.interest.emailHint')}
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            dir="ltr"
            maxLength={INTEREST_LIMITS.email.max}
            error={fieldError(errors.email?.message)}
            {...register('email')}
          />
        );
      case 'universityId':
        return (
          <div key={key} className="flex flex-col gap-2">
            <SelectField
              label={<NumberedLabel n={n}>{t('forms.interest.university')}</NumberedLabel>}
              disabled={!universities.data && !universities.isError}
              aria-busy={universities.isPending || undefined}
              error={fieldError(errors.universityId?.message)}
              details={
                universities.data?.length === 0 ? (
                  <p>{t('auth.signUp.universitiesEmpty')}</p>
                ) : undefined
              }
              {...register('universityId')}
            >
              <option value="">
                {universities.isPending
                  ? t('auth.signUp.universitiesLoading')
                  : t('auth.signUp.universityPlaceholder')}
              </option>
              {universities.data?.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
              <option value={UNIVERSITY_NOT_LISTED}>
                {t('forms.interest.universityNotListed')}
              </option>
            </SelectField>
            {universities.isError && (
              <Callout live variant="error">
                <p>{t('auth.signUp.universitiesError')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void universities.refetch()}
                >
                  {t('auth.signUp.retry')}
                </Button>
              </Callout>
            )}
          </div>
        );
      case 'universityOther':
        return (
          <TextField
            key={key}
            label={<NumberedLabel n={n}>{t('forms.interest.universityOther')}</NumberedLabel>}
            autoComplete="organization"
            maxLength={INTEREST_LIMITS.universityOther.max}
            error={fieldError(errors.universityOther?.message)}
            details={
              <CharacterCount
                value={universityOther.length}
                max={INTEREST_LIMITS.universityOther.max}
              />
            }
            {...register('universityOther')}
          />
        );
      case 'organizationName':
        return (
          <TextField
            key={key}
            label={<NumberedLabel n={n}>{t('forms.interest.organizationName')}</NumberedLabel>}
            autoComplete="organization"
            maxLength={INTEREST_LIMITS.organizationName.max}
            error={fieldError(errors.organizationName?.message)}
            details={
              <CharacterCount
                value={organizationName.length}
                max={INTEREST_LIMITS.organizationName.max}
              />
            }
            {...register('organizationName')}
          />
        );
      case 'lookingFor':
        return (
          <CheckboxGroup
            key={key}
            legend={<NumberedLabel n={n}>{t('forms.interest.lookingFor')}</NumberedLabel>}
            options={items('looking_for')}
            error={errors.lookingFor ? t('forms.common.chooseAtLeastOne') : undefined}
            inputProps={register('lookingFor')}
          />
        );
      case 'fieldOfStudy':
        return select(key, 'field_of_study', n);
      case 'sector':
        return select(key, 'sector', n);
      case 'expertise':
        return select(key, 'expertise', n);
      case 'region':
        return select(key, 'region', n);
      case 'channel':
        return select(key, 'channel', n);
      case 'graduationYear':
        return choice(key, 'graduation_year', n);
      case 'projectStage':
        return choice(key, 'project_stage', n);
      case 'orgSize':
        return choice(key, 'org_size', n);
      case 'experience':
        return choice(key, 'experience', n);
    }
  }

  const failure = submit.error;

  return (
    <FormShell
      title={t('forms.interest.title')}
      intro={t('forms.interest.intro')}
      onSubmit={(event) => void onSubmit(event)}
      spamTrap={register('website')}
      error={failure && t(`forms.errors.${failure.kind}`)}
      errorToken={failure}
      submitLabel={t('forms.interest.submit')}
      submittingLabel={t('forms.interest.submitting')}
      submitting={isSubmitting}
    >
      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <RoleCards
            label={t('forms.interest.roleLabel')}
            value={field.value}
            onChange={(next) => {
              field.onChange(next);
              clearErrors();
              submit.reset();
            }}
          />
        )}
      />

      <div aria-hidden="true" className="-mb-2 border-t border-border" />

      {visibleFields(role, universityId).map((key, index) => renderField(key, index + 1))}

      <CheckboxField
        label={
          <Trans i18nKey="forms.interest.consent" components={{ privacyLink: <PrivacyLink /> }} />
        }
        error={errors.consent ? t('forms.interest.consentRequired') : undefined}
        {...register('consent')}
      />
    </FormShell>
  );
}
