import { Hono } from 'hono';
import { cors } from 'hono/cors';
import config from '../config';
import api from './api';

export default new Hono<HonoSchema>()
    .use(
        '/api/*',
        cors({
            origin: Array.isArray(config.server.corsOrigin)
                ? config.server.corsOrigin
                : config.server.corsOrigin
                  ? '*'
                  : [],
            maxAge: 86400,
        }),
    )
    .route('/api', api);
