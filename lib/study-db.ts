import {env} from 'cloudflare:workers';
export function studyDb(){const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw new Error('Study database binding unavailable');return db;}
