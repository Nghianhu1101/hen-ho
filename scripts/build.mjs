import { mkdir, copyFile, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'notification-client.js', 'date-utils.js']) {
  await copyFile(file, `dist/${file}`);
}
await writeFile('dist/_routes.json', JSON.stringify({ version: 1, include: ['/api/notify'], exclude: [] }, null, 2) + '\n');
await writeFile('dist/_redirects', [...'ABCDE'].map(label => `/${label}-* / 200`).join('\n') + '\n');
console.log('Built static assets in dist/; Pages Functions remain in functions/.');
