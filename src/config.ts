import fs from 'node:fs';
import yaml from 'js-yaml';

type Config = {
    server: {
        host: string;
        port: number;
        base: string;
    };
    optimize: {
        png: {
            enable: boolean;
            verbose: boolean;
        };
        gif: {
            enable: boolean;
            verbose: boolean;
            lossy: boolean | number;
        };
    };
    update: {
        cron: string;
        range: number;
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
    yaml.load(fs.readFileSync('config.yaml', { encoding: 'utf-8' })) as Config,
);
