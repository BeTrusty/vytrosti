import dotenv from 'dotenv';
import path from 'path';

const cwd = process.cwd();

// Load files in order of descending precedence.
// Since dotenv doesn't overwrite existing process.env variables,
// loading .env.local first ensures local overrides take precedence.
dotenv.config({ path: path.resolve(cwd, '.env.local') });
dotenv.config({ path: path.resolve(cwd, '.env.development.local') });
dotenv.config({ path: path.resolve(cwd, '.env.development') });
dotenv.config({ path: path.resolve(cwd, '.env') });
