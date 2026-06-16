import { ArrowPathIcon } from '@heroicons/react/24/outline';
import {useSessionContext} from "@/contexts";

export function SessionRefresher() {
    const { isLoading, loadSessions } = useSessionContext();

    return (
        <button
            type="button"
            className={`absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary ${
                isLoading
                    ? 'cursor-default'
                    : 'cursor-pointer hover:text-text-secondary'
            }`}
            onClick={isLoading ? undefined : loadSessions}
            disabled={isLoading}
            aria-label={isLoading ? 'Loading sessions...' : 'Refresh sessions'}
            tabIndex={-1}
        >
            <ArrowPathIcon className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
    )
}
