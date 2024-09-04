export class SrMutex {
    private mutex: Promise<void> = Promise.resolve();

    async lock(): Promise<() => void> {
        let begin!: () => void;

        const promise = new Promise<void>((resolve) => {
            begin = resolve;
        });

        const oldMutex = this.mutex;
        this.mutex = oldMutex.then(() => promise);

        await oldMutex; // Wait for the previous lock to be released
        return begin;   // Return the function to release the current lock
    }
}
