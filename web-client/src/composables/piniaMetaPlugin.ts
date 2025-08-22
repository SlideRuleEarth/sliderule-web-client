// piniaMetaPlugin.ts
import type { PiniaPluginContext } from 'pinia';

type Meta = {
  id: string;
  createdAt: number;
  inits: number;
  explicitResets: number;
  lastResetAt: number | null;
};

function ensureMeta(store: any): Meta {
  // Initialize exactly once per store instance
  store.__meta ??= {
    id: store.$id,
    createdAt: Date.now(),
    inits: 0,
    explicitResets: 0,
    lastResetAt: null,
  } as Meta;
  store.__meta.inits++;
  return store.__meta as Meta;
}

export function piniaMetaPlugin({ store }: PiniaPluginContext) {
  const meta = ensureMeta(store); // <-- non-null from here on

  // Capture option-store $reset (setup stores may not have it)
  const original$reset = store.$reset?.bind(store);

  if (original$reset) {
    store.$reset = () => {
      meta.explicitResets++;
      meta.lastResetAt = Date.now();
      original$reset();
    };
  }

  // Count your custom "reset" action too
  store.$onAction(({ name, after }) => {
    if (name === 'reset') {
      after(() => {
        meta.explicitResets++;
        meta.lastResetAt = Date.now();
      });
    }
  });
}
