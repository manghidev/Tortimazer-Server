//* Interface to load env variables
//* Note these variables can possibly be undefined as someone could skip these variables or not setup a .env file at all

import json from '../../package.json';

//* Interface for ENV variables
interface ENV {
    NODE_ENV: string | undefined;
    SERVER_VERSION: string;
    AWS_IOT_CORE_ENDPOINT: string | undefined;
    AWS_IOT_CORE_THING_NAME: string | undefined;
    PORT_SOCKET_IO: Number | undefined;
};

//* Loading process.env as ENV interface
const _getConfig = (): ENV => {
    return {
        NODE_ENV: process.env.NODE_ENV,
        SERVER_VERSION: json.version,
        AWS_IOT_CORE_ENDPOINT: process.env.AWS_IOT_CORE_ENDPOINT,
        AWS_IOT_CORE_THING_NAME: process.env.AWS_IOT_CORE_THING_NAME,
        PORT_SOCKET_IO : Number(process.env.PORT_SOCKET_IO)
    };
};

/*
 * Throwing an Error if any field was undefined we don't
 * want our app to run if it can't connect to DB and ensure
 * that these fields are accessible. If all is good return
 * it as Config which just removes the undefined from our type
 * definition.
*/
const _getSanitizedConfig = (config: ENV) => {
    for (const [key, value] of Object.entries(config)) {
        if (value === undefined) {
            throw new Error(`Missing key ${key} in config.env`);
        }
    }
    return config as ENV;
};

// * Sanitizing the config
const sanitizedConfig = _getSanitizedConfig(_getConfig());

// * Exporting env variables
export default sanitizedConfig;