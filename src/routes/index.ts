import { Hono } from 'hono';

import api from './api';

export default new Hono<HonoSchema>().route('/api', api);
