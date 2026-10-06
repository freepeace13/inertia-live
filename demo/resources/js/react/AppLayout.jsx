import { InertiaLiveProvider } from '@freepeace13/inertia-live/react';

export default function AppLayout({ echo, children }) {
    return (
        <InertiaLiveProvider echo={echo} debounceMs={150}>
            {children}
        </InertiaLiveProvider>
    );
}
