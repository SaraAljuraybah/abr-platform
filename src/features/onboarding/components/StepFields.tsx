import { OTHER } from '@shared/interest-options';
import { GraduationCap } from 'lucide-react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ChipInput, ToggleChips } from '@/components/ui/chip-input';
import { CharacterCount } from '@/components/ui/field-number';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { TextareaField } from '@/components/ui/textarea-field';
import { optionItems } from '@/features/forms/options';
import { validationMessage } from '@/lib/zod-i18n';
import {
  ACADEMIC_LEVELS,
  FIELD_OF_STUDY,
  GRADUATION_YEARS,
  INTERESTS,
  ONBOARDING_LIMITS as L,
  SKILL_SUGGESTIONS,
} from '../options';
import type { OnboardingValues } from '../schemas';

type Form = UseFormReturn<OnboardingValues>;

function useFieldError(form: Form) {
  const { t } = useTranslation();
  return (name: keyof OnboardingValues) => {
    const error = form.formState.errors[name];
    const message = Array.isArray(error) ? undefined : error?.message;
    return validationMessage(t, message);
  };
}

export function AboutStep({ form, universityName }: { form: Form; universityName: string | null }) {
  const { t } = useTranslation();
  const fieldError = useFieldError(form);
  const [fullName, bio] = useWatch({ control: form.control, name: ['fullName', 'bio'] });

  return (
    <>
      <TextField
        label={t('onboarding.about.fullName')}
        autoComplete="name"
        maxLength={L.fullName.max}
        error={fieldError('fullName')}
        details={<CharacterCount value={fullName.length} max={L.fullName.max} />}
        {...form.register('fullName')}
      />
      <TextareaField
        label={t('onboarding.about.bio')}
        hint={t('onboarding.about.bioHint')}
        maxLength={L.bio.max}
        error={fieldError('bio')}
        details={<CharacterCount value={bio.length} max={L.bio.max} />}
        {...form.register('bio')}
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-foreground">{t('onboarding.about.university')}</p>
        <p className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2.5 text-foreground">
          <GraduationCap aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          {universityName ?? t('onboarding.about.universityUnknown')}
        </p>
        <p className="text-sm text-muted-foreground">{t('onboarding.about.universityHint')}</p>
      </div>
    </>
  );
}

export function StudiesStep({ form }: { form: Form }) {
  const { t } = useTranslation();
  const fieldError = useFieldError(form);
  const [major, majorOther] = useWatch({ control: form.control, name: ['major', 'majorOther'] });
  const placeholder = <option value="">{t('onboarding.select')}</option>;

  return (
    <>
      <SelectField
        label={t('onboarding.studies.major')}
        error={fieldError('major')}
        {...form.register('major')}
      >
        {placeholder}
        {optionItems(t, 'forms.interest.options.field_of_study', FIELD_OF_STUDY).map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </SelectField>
      {major === OTHER && (
        <TextField
          label={t('onboarding.studies.majorOther')}
          maxLength={L.majorOther.max}
          error={fieldError('majorOther')}
          details={<CharacterCount value={majorOther.length} max={L.majorOther.max} />}
          {...form.register('majorOther')}
        />
      )}
      <SelectField
        label={t('onboarding.studies.academicLevel')}
        error={fieldError('academicLevel')}
        {...form.register('academicLevel')}
      >
        {placeholder}
        {optionItems(t, 'onboarding.options.academicLevel', ACADEMIC_LEVELS).map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t('onboarding.studies.graduationYear')}
        error={fieldError('graduationYear')}
        {...form.register('graduationYear')}
      >
        {placeholder}
        {GRADUATION_YEARS.map((value) => (
          <option key={value} value={value}>
            {value === '2027_or_later'
              ? t('forms.interest.options.graduation_year.2027_or_later')
              : value}
          </option>
        ))}
      </SelectField>
    </>
  );
}

export function SkillsStep({ form }: { form: Form }) {
  const { t } = useTranslation();
  const fieldError = useFieldError(form);

  return (
    <>
      <Controller
        control={form.control}
        name="skills"
        render={({ field }) => (
          <ChipInput
            ref={field.ref}
            label={t('onboarding.skills.skills')}
            hint={t('onboarding.skills.skillsHint')}
            value={field.value}
            onChange={field.onChange}
            max={L.skills.max}
            maxLength={L.skills.chipMax}
            suggestions={SKILL_SUGGESTIONS}
            error={fieldError('skills')}
          />
        )}
      />
      <Controller
        control={form.control}
        name="interests"
        render={({ field }) => (
          <ToggleChips
            label={t('onboarding.skills.interests')}
            hint={t('onboarding.skills.interestsHint')}
            options={optionItems(t, 'onboarding.options.interest', INTERESTS)}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </>
  );
}

export function LinksStep({ form }: { form: Form }) {
  const { t } = useTranslation();
  const fieldError = useFieldError(form);

  return (
    <TextField
      label={t('onboarding.links.github')}
      hint={t('onboarding.links.githubHint')}
      type="url"
      inputMode="url"
      autoComplete="url"
      spellCheck={false}
      dir="ltr"
      placeholder="https://github.com/username"
      error={fieldError('githubUrl')}
      {...form.register('githubUrl')}
    />
  );
}
