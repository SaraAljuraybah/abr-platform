import { useTranslation } from 'react-i18next';
import { showsTodos } from './notice';

type TodoKey = 'legalReview' | 'legalName' | 'minors' | 'replyTime' | 'securityRetention';

/**
 * An open point in the notice, visible only in development builds. Production builds render
 * nothing; the same points are listed in the CHANGELOG under "Before public launch".
 */
export function DevTodo({ todo }: { todo: TodoKey }) {
  const { t } = useTranslation();
  if (!showsTodos()) return null;
  return (
    <p
      data-todo={todo}
      className="my-3 rounded-sm border border-dashed border-warning bg-warning-bg px-3 py-2 text-sm font-medium text-warning"
    >
      <strong>{t('privacy.todoLabel')}</strong> {t(`privacy.todo.${todo}`)}
    </p>
  );
}
