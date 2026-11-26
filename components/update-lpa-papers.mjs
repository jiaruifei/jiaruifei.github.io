import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {refreshSnapshot} from './lpa-sources.mjs';

const args=process.argv.slice(2);
if(args.length && !(args.length===2&&args[0]==='--date'))throw Error('Usage: node components/update-lpa-papers.mjs [--date YYYY-MM-DD]');
const file=fileURLToPath(new URL('../assets/lpa-papers.json',import.meta.url));
const previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
const snapshot=await refreshSnapshot({previous,through:args[1]});
// A partial source failure is still a valid snapshot with a visible error status.
// Preserve its last successful papers, publish the status, and retry next day.
fs.writeFileSync(file+'.tmp',JSON.stringify(snapshot,null,2)+'\n');
fs.renameSync(file+'.tmp',file);
console.log(JSON.stringify({range:snapshot.range,papers:snapshot.papers.length,sources:snapshot.sources.map(({id,status,matchedCount,error})=>({id,status,matchedCount,...(error?{error}:{})}))},null,2));
