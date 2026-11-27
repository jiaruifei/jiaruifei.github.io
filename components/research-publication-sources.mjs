import {createRequest, mergePapers, parseArxiv, parseHexagon} from './lpa-sources.mjs';

const arxivQuery = '(au:"Jiarui Fei" OR au:"Jia Rui Fei" OR au:"Jia-Rui Fei" OR au:"Fei, Jiarui") AND cat:math.*';
const orcid = '0000-0003-1927-109X';
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const authorNames = new Set(['jiaruifei', 'feijiarui', '费佳睿']);
const isAuthor = name => typeof name === 'string' && authorNames.has(normalize(name));
const authorKey = name => isAuthor(name) ? 'jiaruifei' : normalize(name);
const workKey = ({title, authors}) => normalize(title) + '|' + authors.map(authorKey).sort().join('|');
const catalogId = ({source, id}) => source === 'hexagon' ? 'hexagon-' + id : id;
const version = url => Number(String(url).match(/v(\d+)$/)?.[1] || 0);
const linkedArxivId = value => String(value || '')
  .replace(/^(?:https?:\/\/arxiv\.org\/(?:abs|pdf)\/|arxiv:)/i, '').replace(/(?:v\d+)?(?:\.pdf)?$/, '');
const calendarDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Halifax', year: 'numeric', month: '2-digit', day: '2-digit'
});

export async function collectAuthorArxiv({request = createRequest()} = {}) {
  const collected = [];
  let start = 0;
  for (let page = 0; page < 25; page++) {
    const url = new URL('https://export.arxiv.org/api/query');
    url.search = new URLSearchParams({
      search_query: arxivQuery, start, max_results: 100, sortBy: 'lastUpdatedDate', sortOrder: 'descending'
    });
    const {total, records} = parseArxiv(await request(url.href));
    collected.push(...records.filter(record => record.authors.some(isAuthor)));
    start += records.length;
    if (start >= total) return collected;
    if (!records.length) throw Error('arXiv pagination ended early');
  }
  throw Error('arXiv pagination limit reached');
}

function isHexagonAuthor(author) {
  if (author.orcid) return String(author.orcid).split('/').at(-1).toUpperCase() === orcid;
  return isAuthor(author.name) && (!author.affiliation || /shanghai\s+jiao\s*tong|上海交通大学/i.test(author.affiliation));
}

export async function collectAuthorHexagon({request = createRequest()} = {}) {
  const collected = new Map();
  for (const author of ['Fei', '费佳睿']) {
    let cursor = null;
    const seen = new Set();
    for (let page = 0; ; page++) {
      if (page >= 25) throw Error('Hexagon pagination limit reached');
      const url = new URL('https://hexagonmath.org/api/v1/works');
      url.search = new URLSearchParams({author, limit: 100});
      if (cursor) url.searchParams.set('cursor', cursor);
      const data = await request(url.href, 'json');
      const {records, hasMore, cursor: next} = parseHexagon(data);
      for (const [index, record] of records.entries()) {
        if (data.works[index].authors.some(isHexagonAuthor)) collected.set(record.id, record);
      }
      if (!hasMore) break;
      if (!records.length || !next || seen.has(next)) throw Error('Hexagon pagination did not advance');
      seen.add(next);
      cursor = next;
    }
  }
  return [...collected.values()];
}

function inferredTopics({title, abstract}) {
  const text = title + ' ' + abstract;
  const topics = [];
  if (/\b(?:quivers?|representations?|representation.theor\w+|crystals?|crystal (?:bases?|structures?)|cartan algebras?)\b/i.test(text)) {
    topics.push('representations');
  }
  if (/\b(?:cluster (?:algebras?|structures?|monomials?|characters?|seeds?)|laurent phenomenon algebras?|cluster[- ]crystal)\b/i.test(text)) {
    topics.push('clusters');
  }
  if (/\b(?:invariant theory|semi[- ]?invariants?)\b/i.test(text)) topics.push('invariants');
  return topics.length ? topics : ['other'];
}

function toCatalogPaper(paper, source) {
  const summary = paper.abstract.length > 650 ? paper.abstract.slice(0, 650).replace(/\s+\S*$/, '') + '…' : paper.abstract;
  const doi = source.doi?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  return {
    id: catalogId(source), title: paper.title, authors: paper.authors,
    year: Number(source.published.slice(0, 4)), submitted: source.published, updated: source.updated,
    url: source.source === 'arxiv' ? 'https://arxiv.org/abs/' + source.id : source.url,
    repository: source.source, summary, tags: inferredTopics(paper), journal: null,
    journalUrl: /^10\.\d{4,9}\/\S+$/i.test(doi || '') ? 'https://doi.org/' + doi : null
  };
}

function revisionFor(paper, record) {
  const revision = {};
  if (record.updated > paper.updated) revision.updated = record.updated;
  if (record.source === 'hexagon' && version(record.url) > version(paper.url)) revision.url = record.url;
  return Object.keys(revision).length ? {updated: paper.updated, ...revision} : null;
}

export async function refreshPublications({
  catalog, previous = {}, today = calendarDate.format(new Date()),
  collectors = {arxiv: collectAuthorArxiv, hexagon: collectAuthorHexagon}
}) {
  const results = await Promise.allSettled(Object.values(collectors).map(async collect => collect()));
  const records = [];
  const sources = Object.keys(collectors).map((id, index) => {
    const previousSource = previous.sources?.find(source => source.id === id);
    const result = results[index];
    if (result.status === 'fulfilled') {
      records.push(...result.value.filter(record => record.published <= today && record.updated <= today));
      return {id, status: 'complete', checkedOn: today, lastSuccess: today, matches: result.value.length};
    }
    return {
      id, status: 'error', checkedOn: today, lastSuccess: previousSource?.lastSuccess || null,
      error: String(result.reason?.message || result.reason).slice(0, 300)
    };
  });
  const revisions = {...previous.revisions};
  const curated = new Map(catalog.papers.map(paper => [paper.id, paper]));
  const additions = new Map((previous.additions || []).filter(paper => !curated.has(paper.id)).map(paper => [paper.id, paper]));
  const unseen = [];
  for (const record of records) {
    const id = catalogId(record);
    const original = curated.get(id);
    const added = additions.get(id);
    if (original) {
      const revised = {...original, ...revisions[id]};
      const change = revisionFor(revised, record);
      if (change) revisions[id] = {...revisions[id], ...change};
    } else if (added) {
      const change = revisionFor(added, record);
      if (change) additions.set(id, {...toCatalogPaper(record, record), ...change, url: change.url || added.url});
    } else {
      unseen.push(record);
    }
  }
  const knownKeys = new Set([...curated.values(), ...additions.values()].map(workKey));
  for (const paper of mergePapers(unseen)) {
    if (paper.published <= catalog.asOf || knownKeys.has(workKey(paper))) continue;
    if (paper.sources.some(candidate => {
      const id = linkedArxivId(candidate.arxivId);
      return id && (curated.has(id) || additions.has(id));
    })) continue;
    const source = paper.sources.find(candidate => candidate.source === 'arxiv') || paper.sources[0];
    const copy = toCatalogPaper(paper, source);
    additions.set(copy.id, copy);
    knownKeys.add(workKey(copy));
  }
  return {
    schemaVersion: 1,
    checkedOn: sources.every(source => source.status === 'complete') ? today : previous.checkedOn || null,
    sources,
    revisions: Object.fromEntries(Object.entries(revisions).sort(([a], [b]) => a.localeCompare(b))),
    additions: [...additions.values()].sort((a, b) => b.submitted.localeCompare(a.submitted) || a.title.localeCompare(b.title))
  };
}
