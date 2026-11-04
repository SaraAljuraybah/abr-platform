import { zodResolver } from '@hookform/resolvers/zod';
import {
  INTEREST_LIMITS,
  INTEREST_OPTIONS,
  INTEREST_UNIVERSITY_GROUPS,
  type InterestOptionKey,
  OTHER,
} from '@shared/interest-options';
import { useState } from 'react';
import { Controller, type Resolver, useForm, useWatch } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { CheckboxField, CheckboxGroup } from '@/components/ui/checkbox-group';
import { ChoiceGroup } from '@/components/ui/choice-group';
import { CharacterCount, NumberedLabel } from '@/components/ui/field-number';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
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
} from './schema';

type FieldKey =
  | 'fullName'
  | 'email'
  | 'universityCode'
  | 'universityOther'
  | 'fieldOfStudy'
  | 'fieldOfStudyOther'
  | 'graduationYear'
  | 'projectStage'
  | 'organizationName'
  | 'sector'
  | 'lookingFor'
  | 'orgSize'
  | 'expertise'
  | 'experience'
  | 'heardFrom'
  | 'heardFromOther';

type OtherTextKey = 'universityOther' | 'fieldOfStudyOther' | 'heardFromOther';

/** Each "Other (write it)" text field, shown right after the choice that reveals it. */
const OTHER_TEXT: Record<OtherTextKey, { max: number }> = {
  universityOther: INTEREST_LIMITS.universityOther,
  fieldOfStudyOther: INTEREST_LIMITS.fieldOfStudyOther,
  heardFromOther: INTEREST_LIMITS.heardFromOther,
};

interface Choices {
  universityCode: string;
  fieldOfStudy: string;
  heardFrom: string;
}

/** The numbered fields per role, in order (an "Other" text only when Other is chosen). */
function visibleFields(role: FormRole, choices: Choices): FieldKey[] {
  const ifOther = (value: string, key: OtherTextKey): FieldKey[] => (value === OTHER ? [key] : []);
  const roleFields: Record<FormRole, FieldKey[]> = {
    student: [
      'universityCode',
      ...ifOther(choices.universityCode, 'universityOther'),
      'fieldOfStudy',
      ...ifOther(choices.fieldOfStudy, 'fieldOfStudyOther'),
      'graduationYear',
      'projectStage',
    ],
    organization: ['organizationName', 'sector', 'lookingFor', 'orgSize'],
    mentor: ['expertise', 'experience'],
  };
  return [
    'fullName',
    'email',
    ...roleFields[role],
    'heardFrom',
    ...ifOther(choices.heardFrom, 'heardFromOther'),
  ];
}

const OPTIONS_PREFIX = 'forms.interest.options';

export function InterestForm() {
  const { t } = useTranslation();
  const { language, direction } = useDirection();
  const [params] = useSearchParams();
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

  const [role, universityCode, fieldOfStudy, heardFrom, fullName, organizationName] = useWatch({
    control,
    name: ['role', 'universityCode', 'fieldOfStudy', 'heardFrom', 'fullName', 'organizationName'],
  });
  const otherTexts = useWatch({
    control,
    name: ['universityOther', 'fieldOfStudyOther', 'heardFromOther'],
  });
  const otherLength: Record<OtherTextKey, number> = {
    universityOther: otherTexts[0].length,
    fieldOfStudyOther: otherTexts[1].length,
    heardFromOther: otherTexts[2].length,
  };

  const fieldError = (message: string | undefined) => validationMessage(t, message);
  const items = (key: InterestOptionKey, values: readonly string[] = INTEREST_OPTIONS[key]) =>
    optionItems(t, `${OPTIONS_PREFIX}.${key}`, values);
  // Universities in each group, alphabetical by their label in the reader's language.
  const collator = new Intl.Collator(language);
  const universities = (codes: readonly string[]) =>
    items('university_code', codes).sort((a, b) => collator.compare(a.label, b.label));

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

  const placeholder = <option value="">{t('forms.common.selectPlaceholder')}</option>;
  const optionList = (list: { value: string; label: string }[]) =>
    list.map((item) => (
      <option key={item.value} value={item.value}>
        {item.label}
      </option>
    ));

  const select = (
    key: 'fieldOfStudy' | 'sector' | 'expertise' | 'heardFrom',
    option: InterestOptionKey,
    n: number,
  ) => (
    <SelectField
      key={key}
      label={<NumberedLabel n={n}>{t(`forms.interest.${key}`)}</NumberedLabel>}
      error={fieldError(errors[key]?.message)}
      {...register(key)}
    >
      {placeholder}
      {optionList(items(option))}
    </SelectField>
  );

  const choice = (
    key: 'projectStage' | 'orgSize' | 'experience',
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
          layout={key === 'projectStage' ? 'list' : 'pills'}
          error={fieldError(errors[key]?.message)}
        />
      )}
    />
  );

  const otherText = (key: OtherTextKey, n: number) => (
    <TextField
      key={key}
      label={<NumberedLabel n={n}>{t(`forms.interest.${key}`)}</NumberedLabel>}
      autoComplete={key === 'universityOther' ? 'organization' : 'off'}
      maxLength={OTHER_TEXT[key].max}
      error={fieldError(errors[key]?.message)}
      details={<CharacterCount value={otherLength[key]} max={OTHER_TEXT[key].max} />}
      {...register(key)}
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
      case 'universityCode':
        // The form's own list in two groups, "Other" last (not the sign-up universities table).
        return (
          <SelectField
            key={key}
            label={<NumberedLabel n={n}>{t('forms.interest.university')}</NumberedLabel>}
            error={fieldError(errors.universityCode?.message)}
            {...register('universityCode')}
          >
            {placeholder}
            <optgroup label={t('forms.interest.universityGroups.public')}>
              {optionList(universities(INTEREST_UNIVERSITY_GROUPS.public))}
            </optgroup>
            <optgroup label={t('forms.interest.universityGroups.private')}>
              {optionList(universities(INTEREST_UNIVERSITY_GROUPS.private))}
            </optgroup>
            {optionList(items('university_code', [OTHER]))}
          </SelectField>
        );
      case 'graduationYear':
        // Years are digits; only "2027 or later" is translated.
        return (
          <SelectField
            key={key}
            label={<NumberedLabel n={n}>{t('forms.interest.graduationYear')}</NumberedLabel>}
            error={fieldError(errors.graduationYear?.message)}
            {...register('graduationYear')}
          >
            {placeholder}
            {optionList(
              INTEREST_OPTIONS.graduation_year.map((value) => ({
                value,
                label:
                  value === '2027_or_later'
                    ? t('forms.interest.options.graduation_year.2027_or_later')
                    : value,
              })),
            )}
          </SelectField>
        );
      case 'universityOther':
      case 'fieldOfStudyOther':
      case 'heardFromOther':
        return otherText(key, n);
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
      case 'heardFrom':
        return select(key, 'heard_from', n);
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

      {visibleFields(role, { universityCode, fieldOfStudy, heardFrom }).map((key, index) =>
        renderField(key, index + 1),
      )}

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
