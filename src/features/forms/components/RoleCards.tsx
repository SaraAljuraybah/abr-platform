import { Building2, GraduationCap, UserRound } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card';
import { useDirection } from '@/hooks/useDirection';
import { FORM_ROLES, type FormRole, isFormRole } from '../roles';

const ROLE_ICONS = { student: GraduationCap, organization: Building2, mentor: UserRound } as const;

/** The three role cards (Student, Organization, Mentor) with a visible group label. */
export function RoleCards({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FormRole;
  onChange: (role: FormRole) => void;
}) {
  const { t } = useTranslation();
  const { direction } = useDirection();
  const labelId = useId();

  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-sm font-semibold text-foreground">
        {label}
      </p>
      <RadioCardGroup
        aria-labelledby={labelId}
        // No app-wide Radix DirectionProvider: arrow keys must follow the reading direction.
        dir={direction}
        value={value}
        onValueChange={(next) => {
          if (isFormRole(next)) onChange(next);
        }}
      >
        {FORM_ROLES.map((role) => (
          <RadioCard
            key={role}
            value={role}
            icon={ROLE_ICONS[role]}
            title={t(`auth.signUp.roles.${role}.title`)}
            description={t(`auth.signUp.roles.${role}.description`)}
          />
        ))}
      </RadioCardGroup>
    </div>
  );
}
