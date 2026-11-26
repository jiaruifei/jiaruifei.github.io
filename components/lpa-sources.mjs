import {setTimeout as delay} from 'node:timers/promises';

export const scope = 'Title and abstract matches for “Laurent phenomenon algebra(s)” or “LP algebra(s)”, including hyphenated forms. New submissions and revisions in the past calendar month.';
export const sourceDefinitions = [
  {id:'arxiv',name:'arXiv',searchUrl:'https://arxiv.org/search/?query=%22Laurent+phenomenon+algebra%22+OR+%22LP+algebra%22&searchtype=all&abstracts=show&order=-announced_date_first&size=50'},
  {id:'hexagon',name:'Hexagon',searchUrl:'https://hexagonmath.org/search?q=Laurent&per_page=100'}
];

export function calendarMonthRange(through = new Date().toISOString().slice(0,10)) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(through))throw Error('Use an ISO date: YYYY-MM-DD');
  const end = new Date(through+'T00:00:00Z');
  if(!Number.isFinite(+end)||end.toISOString().slice(0,10)!==through)throw Error('Invalid date');
  const start = new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-1,1));
  const last = new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
  start.setUTCDate(Math.min(end.getUTCDate(),last));
  return {from:start.toISOString().slice(0,10),through,basis:'published-or-updated',window:'calendar-month'};
}

const tidy = value => String(value??'').replace(/\s+/g,' ').trim();
export function matchesTopic(title, abstract='') {
  const value = (title+' '+abstract).normalize('NFKC').replace(/[‐‑‒–—−-]/g,' ').replace(/[{}$]/g,'').replace(/\(\s*LP\s*\)/gi,' ').replace(/\s+/g,' ');
  return /\b(?:Laurent\s+phenomenon|LP)\s+algebras?\b/i.test(value);
}

function day(value) {
  const text=String(value??'');
  const iso=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)?text.replace(' ','T')+'Z':text;
  const parsed=new Date(iso);
  if(!Number.isFinite(+parsed))throw Error('Source returned an invalid paper date');
  return parsed.toISOString().slice(0,10);
}
const inRange = (paper,range) => paper.updated>=range.from && paper.updated<=range.through;
const decode = value => String(value??'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,entity)=>{
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  if(named[entity])return named[entity];
  const n=parseInt(entity.slice(entity[1]?.toLowerCase()==='x'?2:1),entity[1]?.toLowerCase()==='x'?16:10);
  return Number.isFinite(n)&&n<=0x10ffff?String.fromCodePoint(n):'�';
});
const xmlTag = (xml,name) => tidy(decode(xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>'))?.[1]));

export function parseArxiv(xml) {
  if(!/<feed\b/.test(xml)||!/<\/feed>/.test(xml))throw Error('arXiv returned an unreadable feed');
  const total=Number(xmlTag(xml,'opensearch:totalResults'));
  if(!/<opensearch:totalResults\b/.test(xml)||!Number.isSafeInteger(total)||total<0)throw Error('arXiv returned no result count');
  const records=[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].map(([,entry])=>{
    const sourceId=xmlTag(entry,'id').replace(/^https?:\/\/arxiv\.org\/abs\//,'');
    if(!/^(?:\d{4}\.\d{4,5}|[a-z.-]+\/\d{7})(?:v\d+)?$/i.test(sourceId))throw Error('arXiv returned an error or invalid identifier');
    const title=xmlTag(entry,'title'),abstract=xmlTag(entry,'summary');
    const authors=[...entry.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/g)].map(([,author])=>xmlTag(author,'name')).filter(Boolean);
    if(!title||!authors.length)throw Error('arXiv returned incomplete paper metadata');
    const published=day(xmlTag(entry,'published')),updated=day(xmlTag(entry,'updated'));
    return {source:'arxiv',id:sourceId.replace(/v\d+$/,''),versionId:sourceId,url:'https://arxiv.org/abs/'+sourceId,title,abstract,authors,published,updated:updated>published?updated:published,doi:xmlTag(entry,'arxiv:doi')||null,labels:[]};
  });
  return {total,records};
}

export function parseHexagon(data) {
  if(!data||!Array.isArray(data.works)||!data.page||typeof data.page.has_more!=='boolean')throw Error('Hexagon returned an unreadable result page');
  if(data.page.has_more&&typeof data.page.next_cursor!=='string')throw Error('Hexagon omitted its next-page cursor');
  const originLabels={human:'Primarily human-written text',mixed:'A mix of human-written and AI-generated text','no-human-author-claimed':'Primarily AI-generated text'};
  const understanding={all:'Human understanding: all parts',some:'Human understanding: some parts',none:'Human understanding: no parts'};
  const records=data.works.map(work=>{
    if(!/^\d{4}\.\d{5}$/.test(work.identifier)||!Number.isSafeInteger(work.versionNumber)||work.versionNumber<1)throw Error('Hexagon returned an invalid identifier');
    const authors=work.authors?.map(author=>tidy(author.name)).filter(Boolean);
    if(!tidy(work.title)||!authors?.length)throw Error('Hexagon returned incomplete paper metadata');
    const published=day(work.publishedAt),revision=day(work.versionCreatedAt||work.publishedAt);
    return {source:'hexagon',id:work.identifier,versionId:work.identifier+'v'+work.versionNumber,url:'https://hexagonmath.org/'+work.identifier+'v'+work.versionNumber,title:tidy(work.title),abstract:tidy(work.abstract),authors,published,updated:revision>published?revision:published,doi:work.doi||null,arxivId:work.arxivId||null,labels:[originLabels[work.authorshipMode],understanding[work.humanUnderstanding]].filter(Boolean)};
  });
  return {records,hasMore:data.page.has_more,cursor:data.page.next_cursor};
}

// Cache once daily in the published site; pace requests as arXiv asks in its API manual.
export function createRequest({fetcher=fetch,wait=delay,interval=3100}={}) {
  const hosts=new Map();
  return async function request(url,format='text') {
    const host=new URL(url).host;
    for(let attempt=0;attempt<3;attempt++){
      await wait(Math.max(0,interval-(Date.now()-(hosts.get(host)||0))));
      hosts.set(host,Date.now());
      try {
        const response=await fetcher(url,{signal:AbortSignal.timeout(30000),headers:{Accept:format==='json'?'application/json':'application/atom+xml','User-Agent':'JiaRui-Homepage-LPA/1.0 (daily public research metadata feed)'}});
        if(!response.ok)throw Error('HTTP '+response.status);
        return format==='json'?await response.json():await response.text();
      }catch(error){if(attempt===2)throw Error(host+': '+error.message);}
    }
  };
}

export async function collectArxiv(range,{request=createRequest(),maxPages=300}={}) {
  // Broad component-word query catches hyphenated and parenthesized full names;
  // LP algebra phrases cover the common abbreviation. Exact matching happens locally.
  const query='(((ti:Laurent OR abs:Laurent) AND (ti:phenomenon OR abs:phenomenon) AND (ti:algebra OR abs:algebra OR ti:algebras OR abs:algebras)) OR ti:"LP algebra" OR abs:"LP algebra" OR ti:"LP algebras" OR abs:"LP algebras")';
  const collected=new Map();
  let start=0,previous='9999-99-99';
  for(let page=0;page<maxPages;page++){
    const url=new URL('https://export.arxiv.org/api/query');
    for(const [k,v] of Object.entries({search_query:query,start,max_results:100,sortBy:'lastUpdatedDate',sortOrder:'descending'}))url.searchParams.set(k,v);
    const {total,records}=parseArxiv(await request(url.href));
    if(!records.length&&start<total)throw Error('arXiv pagination ended before all results were checked');
    for(const paper of records){
      if(paper.updated>previous)throw Error('arXiv returned papers out of date order');
      previous=paper.updated;
      if(inRange(paper,range)&&matchesTopic(paper.title,paper.abstract))collected.set(paper.id,paper);
    }
    start+=records.length;
    if(start>=total||records.at(-1)?.updated<range.from)return [...collected.values()];
  }
  throw Error('arXiv pagination limit reached; results were not marked complete');
}

export async function collectHexagon(range,{request=createRequest(),maxPages=300}={}) {
  const collected=new Map();
  // Hexagon q is a substring filter. Broad terms catch plural/hyphenated names.
  // Exhaust every cursor: Hexagon sorts by first publication, not revision date.
  for(const query of ['Laurent','LP']){
    let cursor=null,finished=false;const cursors=new Set();
    for(let page=0;page<maxPages;page++){
      const url=new URL('https://hexagonmath.org/api/v1/works');
      url.searchParams.set('q',query);url.searchParams.set('limit','100');
      if(cursor)url.searchParams.set('cursor',cursor);
      const result=parseHexagon(await request(url.href,'json'));
      for(const paper of result.records)if(inRange(paper,range)&&matchesTopic(paper.title,paper.abstract))collected.set(paper.id,paper);
      if(!result.hasMore){finished=true;break;}
      if(cursors.has(result.cursor)||!result.records.length)throw Error('Hexagon pagination did not advance');
      cursors.add(result.cursor);cursor=result.cursor;
    }
    if(!finished)throw Error('Hexagon pagination limit reached; results were not marked complete');
  }
  return [...collected.values()];
}

const normalize = value => tidy(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const arxivKey = record => (record.source==='arxiv'?record.id:record.arxivId||'').replace(/^(?:https?:\/\/arxiv\.org\/(?:abs|pdf)\/|arxiv:)/i,'').replace(/\.pdf$/,'').replace(/v\d+$/,'');
export function mergePapers(records) {
  const groups=[];
  for(const record of records){
    const titleKey=normalize(record.title),authorKey=record.authors.map(normalize).sort().join('|');
    const doiKey=record.doi?String(record.doi).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').toLowerCase():null;
    const arxivId=arxivKey(record);
    let group=groups.find(g=>g.records.some(r=>(r.source===record.source&&r.id===record.id)||(arxivId&&arxivKey(r)===arxivId))||(doiKey&&g.dois.has(doiKey))||(titleKey&&authorKey&&g.titleKey===titleKey&&g.authorKey===authorKey));
    if(!group){group={titleKey,authorKey,dois:new Set(),records:[]};groups.push(group);}
    if(doiKey)group.dois.add(doiKey);
    const old=group.records.findIndex(r=>r.source===record.source&&r.id===record.id);
    if(old<0)group.records.push(record);
    else if(record.updated>group.records[old].updated||(!record.stale&&group.records[old].stale))group.records[old]=record;
  }
  return groups.map(group=>{
    const records=[...group.records].sort((a,b)=>b.updated.localeCompare(a.updated)||a.source.localeCompare(b.source));
    const primary=records[0],canonical=records.find(r=>r.source==='arxiv')||primary;
    const sources=records.map(({source,id,versionId,url,published,updated,doi,arxivId,labels,stale})=>({source,id,versionId,url,published,updated,...(doi?{doi}:{}),...(arxivId?{arxivId}:{}),...(labels.length?{labels}:{}),...(stale?{stale:true}:{})}));
    return {id:canonical.source+':'+canonical.id,title:primary.title,authors:primary.authors,abstract:primary.abstract,published:records.map(r=>r.published).sort()[0],updated:primary.updated,activityDate:primary.updated,sources,labels:[...new Set(records.flatMap(r=>r.labels))]};
  }).sort((a,b)=>b.activityDate.localeCompare(a.activityDate)||a.title.localeCompare(b.title));
}

export async function refreshSnapshot({previous={},through,now=new Date().toISOString(),collectors={arxiv:collectArxiv,hexagon:collectHexagon}}={}) {
  const range=calendarMonthRange(through),sources=[],records=[];
  for(const source of sourceDefinitions){
    try {
      const found=await collectors[source.id](range);
      records.push(...found);
      sources.push({...source,status:'complete',checkedAt:now,lastSuccessAt:now,matchedCount:found.length});
    }catch(error){
      const saved=previous.sources?.find(s=>s.id===source.id);
      let count=0;
      for(const paper of previous.papers||[])for(const old of paper.sources||[])if(old.source===source.id&&inRange(old,range)){
        records.push({...paper,...old,source:source.id,labels:old.labels||paper.labels||[],stale:true});count++;
      }
      sources.push({...source,status:'error',checkedAt:now,lastSuccessAt:saved?.lastSuccessAt||null,matchedCount:count,error:String(error.message||error).slice(0,350)});
    }
  }
  return {schemaVersion:1,topic:'Laurent Phenomenon Algebras',checkedAt:now,range,scope,sources,papers:mergePapers(records)};
}
