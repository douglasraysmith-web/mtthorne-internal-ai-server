import { readFile } from 'node:fs/promises';
const files = ['package-lock.json', '.npmrc'];
const forbidden = ['applied-caas-gateway','internal.api.openai.org','artifactory/api/npm/npm-public'];
let failed = false;
for (const file of files) {
  try {
    const text = await readFile(file, 'utf8');
    for (const token of forbidden) {
      if (text.includes(token)) {
        console.error(`Forbidden registry reference in ${file}: ${token}`);
        failed = true;
      }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
if (failed) process.exit(1);
console.log('Public registry verification passed.');
