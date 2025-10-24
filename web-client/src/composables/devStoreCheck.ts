// devStoreChecks.ts
import { createLogger } from '@/utils/logger';

const logger = createLogger('devStoreCheck');

export function logStoreMeta(store: any, label = store.$id) {
    logger.debug(`[${label}] meta`, { meta: store.__meta });
}

export function assertNotReset(store: any, getDefaults: () => any, label = store.$id) {
    const sameAsDefault =
        JSON.stringify(store.$state) === JSON.stringify(getDefaults());
    const meta = store.__meta;

    console.table([{
        store: label,
        sameAsDefault,                 // should be false during normal use
        explicitResets: meta?.explicitResets ?? 'n/a',
        inits: meta?.inits ?? 'n/a',
        createdAt: meta?.createdAt ?? 'n/a',
        lastResetAt: meta?.lastResetAt ?? 'n/a',
    }]);
}
