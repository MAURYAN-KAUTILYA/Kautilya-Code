import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { registerIndicaRoutes } from './infra/indica-routes.js';

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const ENABLED_VARIANTS = new Set(['812hybrid']);

if (!process.env.OPENROUTER_API_KEY) {
  console.error('\n  FATAL: OPENROUTER_API_KEY is not set\n');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

registerIndicaRoutes(app, { enabledVariants: ENABLED_VARIANTS });

app.listen(PORT, () => {
  console.log('\n  KAUTILYA LEGACY CHAT SERVER');
  console.log('  Compatibility surface for /api/chat and /api/indica/*');
  console.log('  The main coding backend now lives on http://localhost:3002\n');
  console.log(`  http://localhost:${PORT}\n`);
});
