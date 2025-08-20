import { Hono } from 'hono';

import emoticon from './emoticon';
import update from './update';

export default new Hono<HonoSchema>()
    .route('/emoticon', emoticon)
    .route('/emoticon/update', update);
