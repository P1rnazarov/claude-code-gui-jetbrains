import {useSettings} from '@/contexts/SettingsContext';
import {useClaudeSettings} from '@/contexts/ClaudeSettingsContext';
import {useWorkingDir} from '@/contexts/WorkingDirContext';

export function ScopeTabs() {
    const {scope, setScope} = useSettings();
    const {setScope: setClaudeScope} = useClaudeSettings();
    const {workingDirectory} = useWorkingDir();

    const handleScopeChange = (newScope: 'global' | 'project') => {
        setScope(newScope);
        setClaudeScope(newScope);
    };

    return (
        <div className="flex items-center border-b border-zinc-800 pt-2 px-2">
            <button
                onClick={() => handleScopeChange('global')}
                className={`px-3 py-2 text-[0.8461rem] rounded-t-md font-medium transition-colors ${
                    scope === 'global'
                        ? 'text-zinc-100 bg-zinc-700/50'
                        : 'text-zinc-600 hover:text-zinc-300'
                }`}
            >
                User Settings (Global)
            </button>
            <button
                onClick={() => handleScopeChange('project')}
                disabled={!workingDirectory}
                className={`px-3 py-2 text-[0.8461rem] rounded-t-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    scope === 'project'
                        ? 'text-zinc-100 bg-zinc-700/50'
                        : 'text-zinc-600 hover:text-zinc-300'
                }`}
                title={!workingDirectory ? 'Open a project to use project settings' : undefined}
            >
                Project Settings (Local)
            </button>
        </div>
    );
}
