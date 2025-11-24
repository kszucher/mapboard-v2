import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Convert import.meta.url to directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root (one level above src)
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex-shared/convex/_generated/api.js';

// Debug: check that the URL is loaded
if (!process.env.CONVEX_URL) {
  throw new Error('CONVEX_URL is not set in .env.local');
}
console.log('Using Convex URL:', process.env.CONVEX_URL);

const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function main() {
  try {
    const { mapId } = await client.mutation(api.maps.createMap, {});
    console.log('Created map with id:', mapId);
  } catch (err) {
    console.error('Error creating map:', err);
  }
}

main();
