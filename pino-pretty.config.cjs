const { inspect } = require('node:util');
const { isColorSupported } = require('pino-pretty');

/** @type {import('pino-pretty').PrettyOptions} */
const config = {
    ignore: 'hostname,module,http',
    translateTime: "SYS:yyyy-mm-dd'T'HH:MM:sso",
    // https://github.com/pinojs/pino-pretty/blob/master/lib/colors.js
    customColors: {
        property: 'reset',
        message: 'reset',
    },
    useOnlyCustomProps: false,
    messageFormat: (
        /**
         * @type {Record<string, unknown> & {
         *  http: {
         *      remoteAddress: String,
         *      remotePort: Number,
         *      method: String,
         *      path: String,
         *      status: Number,
         *      time: Number,
         *  },
         * }}
         */
        log,
        messageKey,
        _levelLabel,
        { colors },
    ) => {
        const { http } = log;
        if (http) {
            const coloredStatus = (
                [
                    /* 0xx */ colors.reset,
                    /* 1xx */ colors.blueBright,
                    /* 2xx */ colors.greenBright,
                    /* 3xx */ colors.cyanBright,
                    /* 4xx */ colors.yellowBright,
                    /* 5xx */ colors.redBright,
                ][(http.status / 100) | 0] ?? colors.reset
            )(http.status);
            log[messageKey] =
                `${http.remoteAddress} ${http.method} ${http.path} ${coloredStatus} ${http.time.toFixed(2)}ms`;
        }
        return `${colors.cyan(`[${log.module}]`)} ${log[messageKey]}`;
    },
};

// https://github.com/osher/pino-prettier/blob/master/lib/custom-prettifiers.js
config.customPrettifiers = new Proxy(config.customPrettifiers ?? {}, {
    get: (target, prop) => {
        if (['level', 'time', 'pid'].includes(prop)) return;
        if (target[prop]) return (...args) => target[prop](...args);
        return value => inspect(value, { colors: isColorSupported });
    },
});

module.exports = config;
