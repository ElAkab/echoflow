import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '.env.local');
console.log('Reading:', envPath);
console.log('Exists:', existsSync(envPath));

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  console.log('\nContent:');
  console.log(content);
  
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  console.log('\nParsed vars:');
  lines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    console.log(`  ${key}: ${value.substring(0, 40)}...`);
  });
}
