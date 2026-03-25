import { Hono } from 'hono';
import parcel from './parcel';

export default new Hono<HonoSchema>().route('/parcel', parcel);
