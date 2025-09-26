// biome-ignore lint/correctness/noUnusedVariables: no reason
interface Window {
    chiya: {
        dialog: import('naive-ui').DialogProviderInst & {
            alert: (options: import('naive-ui').DialogOptions) => Promise<void>;
            confirm: (
                options: import('naive-ui').DialogOptions,
            ) => Promise<boolean | null>;
            // prompt: (
            //     options: import('naive-ui').DialogOptions & {
            //         defaultValue?: string;
            //         placeholder?: string;
            //     },
            // ) => Promise<string | null>;
        };
    };
}
