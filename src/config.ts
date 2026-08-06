import fs from 'node:fs';
import { load } from 'js-yaml';

type Config = {
    server: {
        host: string;
        port: number;
        base: string;
        corsOrigin: string[] | boolean;
    };
    optimize: {
        png: {
            enable: boolean;
            zopfli: boolean | number;
            verbose: boolean;
        };
        gif: {
            enable: boolean;
            verbose: boolean;
            lossy: boolean | number;
        };
    };
    update: {
        cron: string | null;
        range: {
            qq: number;
            bilibili: number;
        };
        salt: string;
        token?: string;
    };
};

const deepFreeze = <T extends object>(obj: T) => {
    for (const prop of Object.getOwnPropertyNames(obj)) {
        // biome-ignore lint/suspicious/noExplicitAny: no reason
        const value = (obj as any)[prop];
        if (value && typeof value === 'object') {
            deepFreeze(value);
        }
    }
    return Object.freeze(obj);
};

export default deepFreeze(
    load(fs.readFileSync('config.yaml', { encoding: 'utf-8' })) as Config,
);
