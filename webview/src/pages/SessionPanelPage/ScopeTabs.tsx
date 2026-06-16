/**
 * 세션 범위 탭. Cursor 좌측 패널의 Local/Web 토글에 대응한다.
 * Web 세션(클라우드 에이전트)은 아직 제품에 없으므로 Local만 데이터가 채워진다.
 */
export enum SessionScope {
  Local = 'local',
  Web = 'web',
}

interface Props {
  scope: SessionScope;
  onScopeChange: (scope: SessionScope) => void;
}

const TABS: { scope: SessionScope; label: string }[] = [
  { scope: SessionScope.Local, label: 'Local' },
  { scope: SessionScope.Web, label: 'Web' },
];

export function ScopeTabs(props: Props) {
  const { scope, onScopeChange } = props;

  return (
    <div className="flex gap-1 p-0.5 bg-surface-overlay rounded">
      {TABS.map((tab) => (
        <button
          key={tab.scope}
          onClick={() => onScopeChange(tab.scope)}
          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
            scope === tab.scope
              ? 'bg-surface-raised text-text-primary'
              : 'text-text-tertiary hover:text-text-secondary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
