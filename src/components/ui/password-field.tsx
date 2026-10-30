import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextField, type TextFieldProps } from './text-field';

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'endAdornment' | 'inputClassName'>;

/**
 * TextField with a show/hide toggle. The toggle's name changes with the state ("Show password" /
 * "Hide password"); no aria-pressed, which would repeat the same information.
 */
export function PasswordField(props: PasswordFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      inputClassName="pe-12"
      endAdornment={
        <button
          type="button"
          onClick={() => {
            setVisible((value) => !value);
          }}
          aria-label={visible ? t('passwordField.hide') : t('passwordField.show')}
          className="inline-flex size-9 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-brand"
        >
          <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </button>
      }
    />
  );
}
