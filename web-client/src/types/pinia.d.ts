// pinia.d.ts
import 'pinia';

declare module 'pinia' {
  export interface PiniaCustomProperties {
    __meta?: {
      id: string;
      createdAt: number;
      inits: number;
      explicitResets: number;
      lastResetAt: number | null;
    };
  }
}
