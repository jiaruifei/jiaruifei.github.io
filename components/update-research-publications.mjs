import fs from 'node:fs';
import {refreshPublications} from './research-publication-sources.mjs';

const catalogPath = new URL('../assets/research-catalog.json', import.meta.url);
const output = new URL('../assets/research-publications.json', import.meta.url);
const pending = new URL('../assets/research-publications.json.tmp', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : {};
const snapshot = await refreshPublications({catalog, previous});

if (snapshot.sources.every(source => source.status === 'error')) {
  throw Error('Both author searches failed: ' + snapshot.sources.map(source => source.error).join('; '));
}
fs.writeFileSync(pending, JSON.stringify(snapshot, null, 2) + '\n');
fs.renameSync(pending, output);
console.log(JSON.stringify({
  sources: snapshot.sources, additions: snapshot.additions.length, revisions: Object.keys(snapshot.revisions).length
}, null, 2));
