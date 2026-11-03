import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, ExternalLink, GraduationCap, UserRound } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Controller, type Resolver, useForm, useWatch } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CharacterCount, FieldProgress, NumberedLabel } from '@/components/ui/field-number';
import { PasswordField } from '@/components/ui/password-field';
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useDirection } from '@/hooks/useDirection';
import { validationMessage } from '@/lib/zod-i18n';
import {
  type AuthFailure,
  toAuthFailure,
  useCheckStudentEmail,
  useSignUp,
  useUniversities,
} from '../api';
import {
  FULL_NAME_MAX,
  isSignUpRole,
  roleFromParam,
  ORGANIZATION_NAME_MAX,
  signUpSchema,
  type SignUpFormValues,
  type SignUpRole,
  type SignUpValues,
} from '../schemas';
import { PasswordChecklist } from './PasswordChecklist';

const PRIVACY_URL = 'https://tryabr.com/privacy';

type FieldKey = 'fullName' | 'organizationName' | 'universityId' | 'email' | 'password';

/** The numbered fields per role, in order. */
const ROLE_FIELDS: Record<SignUpRole, readonly FieldKey[]> = {
  student: ['fullName', 'universityId', 'email', 'password'],
  organization: ['organizationName', 'fullName', 'email', 'password'],
  mentor: ['fullName', 'email', 'password'],
};

const ROLE_ICONS = { student: GraduationCap, organization: Building2, mentor: UserRound } as const;

/** Set on the email field when check_student_email() says no; translated at render. */
const MISMATCH = 'mismatch';

const linkClass = 'rounded-sm font-semibold text-primary underline-offset-4 hover:underline';

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+$/.test(value.trim());

function PrivacyLink({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <a
      href={PRIVACY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 ${linkClass}`}
    >
      {children}
      <span className="sr-only">{t('auth.signUp.opensInNewTab')}</span>
      <ExternalLink aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
    </a>
  );
}

export function SignUpForm() {
  const { t } = useTranslation();
  const { language, direction } = useDirection();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signUp = useSignUp();
  const universities = useUniversities(language);
  const checkStudentEmail = useCheckStudentEmail();
  const [preCheckFailure, setPreCheckFailure] = useState<AuthFailure | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const honeypotId = useId();
  const roleLabelId = useId();

  const {
    register,
    control,
    handleSubmit,
    getValues,
    getFieldState,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues, unknown, SignUpValues>({
    // The schema is a union per role; the form keeps every role's fields in one flat state.
    resolver: zodResolver(signUpSchema) as unknown as Resolver<
      SignUpFormValues,
      unknown,
      SignUpValues
    >,
    defaultValues: {
      role: roleFromParam(params.get('role')),
      fullName: '',
      organizationName: '',
      universityId: '',
      email: '',
      password: '',
      website: '',
    },
  });

  const [role, fullName, organizationName, password] = useWatch({
    control,
    name: ['role', 'fullName', 'organizationName', 'password'],
  });
  const fields = ROLE_FIELDS[role];
  const failure = preCheckFailure ?? signUp.error;

  // A new failure is a new error object: move focus to the message so it is read once.
  useEffect(() => {
    if (failure) errorRef.current?.focus();
  }, [failure]);

  const universityName = (id: string) =>
    universities.data?.find((university) => university.id === id)?.name ?? '';

  const fieldError = (message: string | undefined) => validationMessage(t, message);

  const emailError = () => {
    const error = errors.email;
    if (error?.type === MISMATCH) {
      return t('auth.signUp.emailMismatch', {
        university: universityName(getValues('universityId')),
      });
    }
    return fieldError(error?.message);
  };

  const passwordError = () => {
    const message = errors.password?.message;
    if (!message) return undefined;
    return message === 'validation.required'
      ? t('validation.required')
      : t('auth.signUp.passwordNotMet');
  };

  /** Blur and university-change pre-check. A failed check stays silent; submit reports it. */
  async function precheckEmail() {
    const { role: current, universityId, email, website } = getValues();
    // A filled spam trap never reaches Supabase, not even for the pre-check.
    if (website || current !== 'student' || !universityId || !looksLikeEmail(email)) return;
    try {
      const belongs = await checkStudentEmail(universityId, email);
      if (!belongs) setError('email', { type: MISMATCH });
      else if (getFieldState('email').error?.type === MISMATCH) clearErrors('email');
    } catch {
      // Reported on submit.
    }
  }

  const onSubmit = handleSubmit(async (submitted) => {
    setPreCheckFailure(null);
    signUp.reset();
    const done = () => navigate('/check-email', { state: { email: submitted.email } });

    // Spam trap: a filled hidden field gets the normal success screen and no request at all.
    if (getValues('website')) {
      await done();
      return;
    }

    if (submitted.role === 'student') {
      let belongs: boolean;
      try {
        belongs = await checkStudentEmail(submitted.universityId, submitted.email);
      } catch (error) {
        setPreCheckFailure(toAuthFailure(error));
        return;
      }
      if (!belongs) {
        setError('email', { type: MISMATCH }, { shouldFocus: true });
        return;
      }
    }

    try {
      await signUp.mutateAsync(submitted);
    } catch {
      return; // signUp.error drives the message.
    }
    await done();
  });

  function renderField(key: FieldKey, n: number) {
    switch (key) {
      case 'fullName':
        return (
          <TextField
            key={key}
            label={
              <NumberedLabel n={n}>
                {role === 'organization'
                  ? t('auth.signUp.yourFullName')
                  : t('auth.signUp.fullName')}
              </NumberedLabel>
            }
            autoComplete="name"
            maxLength={FULL_NAME_MAX}
            error={fieldError(errors.fullName?.message)}
            details={<CharacterCount value={fullName.length} max={FULL_NAME_MAX} />}
            {...register('fullName')}
          />
        );
      case 'organizationName':
        return (
          <TextField
            key={key}
            label={<NumberedLabel n={n}>{t('auth.signUp.organizationName')}</NumberedLabel>}
            autoComplete="organization"
            maxLength={ORGANIZATION_NAME_MAX}
            error={fieldError(errors.organizationName?.message)}
            details={<CharacterCount value={organizationName.length} max={ORGANIZATION_NAME_MAX} />}
            {...register('organizationName')}
          />
        );
      case 'universityId':
        return (
          <div key={key} className="flex flex-col gap-2">
            <SelectField
              label={<NumberedLabel n={n}>{t('auth.signUp.university')}</NumberedLabel>}
              hint={
                <p>
                  {universities.data?.length === 0 && <>{t('auth.signUp.universitiesEmpty')} </>}
                  <Link to="/request-access" className={linkClass}>
                    {t('auth.signUp.cantFindUniversity')}
                  </Link>
                </p>
              }
              disabled={!universities.data}
              aria-busy={universities.isPending || undefined}
              error={fieldError(errors.universityId?.message)}
              {...register('universityId', {
                onChange: () => {
                  if (getFieldState('email').error?.type === MISMATCH) clearErrors('email');
                  void precheckEmail();
                },
              })}
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
      case 'email': {
        const student = role === 'student';
        return (
          <TextField
            key={key}
            label={
              <NumberedLabel n={n}>
                {student
                  ? t('auth.signUp.universityEmail')
                  : role === 'organization'
                    ? t('auth.signUp.workEmail')
                    : t('auth.signUp.email')}
              </NumberedLabel>
            }
            hint={
              student
                ? t('auth.signUp.universityEmailHint')
                : role === 'organization'
                  ? t('auth.signUp.workEmailHint')
                  : undefined
            }
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            dir="ltr"
            error={emailError()}
            details={
              student && (
                <Link to="/request-access" className={`inline-block text-sm ${linkClass}`}>
                  {t('auth.signUp.universityEmailTrouble')}
                </Link>
              )
            }
            {...register('email', { onBlur: () => void precheckEmail() })}
          />
        );
      }
      case 'password':
        return (
          <PasswordField
            key={key}
            label={<NumberedLabel n={n}>{t('auth.signUp.password')}</NumberedLabel>}
            autoComplete="new-password"
            error={passwordError()}
            details={<PasswordChecklist value={password} />}
            {...register('password')}
          />
        );
    }
  }

  return (
    <>
      <h1 className="text-brand">{t('auth.signUp.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('auth.signUp.intro')}</p>

      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="mt-6 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-2">
          <p id={roleLabelId} className="text-sm font-semibold text-foreground">
            {t('auth.signUp.roleLabel')}
          </p>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <RadioCardGroup
                aria-labelledby={roleLabelId}
                // No app-wide Radix DirectionProvider: arrow keys must follow the reading direction.
                dir={direction}
                value={field.value}
                onValueChange={(value) => {
                  if (!isSignUpRole(value)) return;
                  field.onChange(value);
                  clearErrors();
                  setPreCheckFailure(null);
                  signUp.reset();
                }}
              >
                {(['student', 'organization', 'mentor'] as const).map((value) => (
                  <RadioCard
                    key={value}
                    value={value}
                    icon={ROLE_ICONS[value]}
                    title={t(`auth.signUp.roles.${value}.title`)}
                    description={t(`auth.signUp.roles.${value}.description`)}
                  />
                ))}
              </RadioCardGroup>
            )}
          />
        </div>

        {role === 'mentor' && (
          <Callout live variant="info">
            <p>{t('auth.signUp.mentorNotice')}</p>
          </Callout>
        )}

        <FieldProgress
          total={fields.length}
          srLabel={t('auth.signUp.progress', { total: fields.length })}
          className="-mb-2 border-t border-border pt-5"
        />

        {fields.map((key, index) => renderField(key, index + 1))}

        {/* Spam trap: hidden from people and assistive technology; bots fill it. The label is an
            instruction, so anyone who still reaches it knows to leave it empty. */}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor={honeypotId}>{t('auth.signUp.honeypotLabel')}</label>
          <input
            id={honeypotId}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register('website')}
          />
        </div>

        {failure && (
          <Callout ref={errorRef} tabIndex={-1} variant="error">
            <p>{t(`auth.errors.${failure.kind}`)}</p>
          </Callout>
        )}

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={isSubmitting}
            loadingText={t('auth.signUp.submitting')}
          >
            {t('auth.signUp.submit')}
          </Button>
          <p className="text-sm text-muted-foreground">
            <Trans i18nKey="auth.signUp.consent" components={{ privacyLink: <PrivacyLink /> }} />
          </p>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.signUp.haveAccount')}{' '}
        <Link to="/sign-in" className={linkClass}>
          {t('auth.signUp.signIn')}
        </Link>
      </p>
    </>
  );
}
