import { Hono } from 'hono';

import api from './api';
import proxy from './proxy';

export default new Hono<HonoSchema>().route('/api', api).route('/proxy', proxy);
