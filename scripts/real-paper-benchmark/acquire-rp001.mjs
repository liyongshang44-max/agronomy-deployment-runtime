import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const PMCID = 'PMC9656380';
const PAPER_ID = 'RP001';
const OA_API = `https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi?id=${PMCID}`;
const OUTPUT_DIR = resolve(process.env.ADR_RP001_ACQUISITION_DIR ?? '.adr-benchmark/acquisition');
const CORPUS_PATH = resolve(process.env.ADR_REAL_PAPER_CORPUS_PATH ?? 'docs/implementation/real-paper-benchmark/corpus-v1.json');
const USER_AGENT = 'ADR-RP001-Benchmark/1.0';

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function attrs(fragment) {
  const result = {};
  for (const match of fragment.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)="([^"]*)"/g)) {
    result[match[1]] = decodeXml(match[2]);
  }
  return result;
}

function parseOa(xml) {
  const error = xml.match(/<error\b[^>]*>([\s\S]*?)<\/error>/i);
  if (error) throw new Error(`PMC OA API error: ${error[1].replace(/<[^>]+>/g, '').trim()}`);
  const record = xml.match(new RegExp(`<record\\b([^>]*)\\bid="${PMCID}"([^>]*)>([\\s\\S]*?)<\\/record>`, 'i'));
  if (!record) throw new Error(`PMC OA API did not return exact ${PMCID} record`);
  const recordAttrs = attrs(`${record[1]} id="${PMCID}" ${record[2]}`);
  const links = {};
  for (const match of record[3].matchAll(/<link\b([^>]*?)\/?\s*>/gi)) {
    const link = attrs(match[1]);
    if (link.format && link.href) links[link.format] = link.href;
  }
  const format = links.pdf ? 'pdf' : links.tgz ? 'tgz' : null;
  if (!format) throw new Error('PMC OA API returned neither pdf nor tgz resource');
  return { format, href: links[format], license: recordAttrs.license ?? null, citation: recordAttrs.citation ?? null };
}

function httpsFromResource(href) {
  if (href.startsWith('ftp://ftp.ncbi.nlm.nih.gov/')) {
    return `https://ftp.ncbi.nlm.nih.gov/${href.slice('ftp://ftp.ncbi.nlm.nih.gov/'.length)}`;
  }
  if (href.startsWith('https://')) return href;
  throw new Error(`unsupported PMC OA resource scheme: ${href}`);
}

function downloadCandidates(href) {
  const exact = httpsFromResource(href);
  const marker = 'https://ftp.ncbi.nlm.nih.gov/pub/pmc/';
  const candidates = [];
  if (exact.startsWith(marker) && !exact.startsWith(`${marker}deprecated/`)) {
    candidates.push(`${marker}deprecated/${exact.slice(marker.length)}`);
  }
  candidates.push(exact);
  return [...new Set(candidates)];
}

async function downloadFirst(urls) {
  const failures = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': USER_AGENT }
      });
      if (!response.ok) {
        failures.push(`${url} -> HTTP ${response.status}`);
        continue;
      }
      return { url, bytes: Buffer.from(await response.arrayBuffer()) };
    } catch (error) {
      failures.push(`${url} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`unable to download PMC OA resource: ${failures.join('; ')}`);
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

function selectPrimaryPdf(packageDir) {
  const pdfs = walk(packageDir).filter((path) => path.toLowerCase().endsWith('.pdf'));
  let candidates = pdfs.filter((path) => basename(path).toLowerCase() === 'plants-11-03007.pdf');
  if (candidates.length === 0) {
    candidates = pdfs.filter((path) => basename(path).toLowerCase().includes('3007') && !basename(path).toLowerCase().includes('supp'));
  }
  if (candidates.length !== 1) {
    if (pdfs.length === 1) candidates = pdfs;
    else throw new Error(`cannot uniquely identify primary RP001 PDF; candidates=${pdfs.map((path) => relative(packageDir, path)).join(',')}`);
  }
  return candidates[0];
}

function exactCorpusPin() {
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, 'utf8'));
  if (corpus?.benchmarkId !== 'ADR_REAL_PAPER_BENCHMARK_V1' || !Array.isArray(corpus.papers)) {
    throw new Error('invalid real-paper corpus authority');
  }
  const matches = corpus.papers.filter((paper) => paper.paperId === PAPER_ID);
  if (matches.length !== 1) throw new Error(`corpus must contain exactly one ${PAPER_ID} record`);
  const pin = matches[0].exactSourceArtifactPin;
  if (!pin || pin.pinVersion !== 'adr.real-paper-source-artifact-pin.v1') {
    throw new Error(`${PAPER_ID} exactSourceArtifactPin is required before acquisition`);
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(pin.contentHash)) throw new Error(`${PAPER_ID} pin contentHash is invalid`);
  if (!Number.isSafeInteger(pin.byteLength) || pin.byteLength <= 0) throw new Error(`${PAPER_ID} pin byteLength is invalid`);
  if (pin.mismatchDisposition !== 'FAIL_CLOSED_BEFORE_RIGHTS_RETENTION') {
    throw new Error(`${PAPER_ID} pin must fail closed before Rights retention`);
  }
  return pin;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const pin = exactCorpusPin();
const response = await fetch(OA_API, { headers: { 'user-agent': USER_AGENT } });
if (!response.ok) throw new Error(`PMC OA API returned HTTP ${response.status}`);
const xml = await response.text();
writeFileSync(join(OUTPUT_DIR, 'oa-response.xml'), xml, 'utf8');
const oa = parseOa(xml);
const downloaded = await downloadFirst(downloadCandidates(oa.href));

let pdfBytes;
let memberPath = null;
if (oa.format === 'pdf') {
  pdfBytes = downloaded.bytes;
} else {
  const archive = join(OUTPUT_DIR, 'rp001.tar.gz');
  const packageDir = join(OUTPUT_DIR, 'package');
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(archive, downloaded.bytes);
  const extracted = spawnSync('tar', ['-xzf', archive, '-C', packageDir], { encoding: 'utf8' });
  if (extracted.status !== 0) throw new Error(`unable to extract PMC OA package: ${extracted.stderr}`);
  const selected = selectPrimaryPdf(packageDir);
  pdfBytes = readFileSync(selected);
  memberPath = relative(packageDir, selected).replaceAll('\\', '/');
}

if (pdfBytes.byteLength < 5 || pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
  throw new Error('resolved RP001 resource is not a PDF');
}

const contentHash = `sha256:${createHash('sha256').update(pdfBytes).digest('hex')}`;
if (contentHash !== pin.contentHash || pdfBytes.byteLength !== pin.byteLength) {
  throw new Error(
    `RP001 exact corpus pin mismatch before Rights retention: expected ${pin.contentHash}/${pin.byteLength}, received ${contentHash}/${pdfBytes.byteLength}`
  );
}

const pdfPath = join(OUTPUT_DIR, 'rp001.pdf');
writeFileSync(pdfPath, pdfBytes);
const acquisitionLocator = memberPath ? `${downloaded.url}#${memberPath}` : downloaded.url;
writeFileSync(join(OUTPUT_DIR, 'locator.txt'), `${acquisitionLocator}\n`, 'utf8');
const evidence = {
  schemaVersion: 'adr.rp001-acquisition.v1',
  paperId: PAPER_ID,
  pmcid: PMCID,
  oaApi: OA_API,
  oaLicense: oa.license,
  oaCitation: oa.citation,
  oaResourceFormat: oa.format,
  oaResourceHref: oa.href,
  resolvedDownloadUrl: downloaded.url,
  packageMember: memberPath,
  acquisitionLocator,
  pdfPath,
  contentHash,
  byteLength: pdfBytes.byteLength,
  corpusPin: {
    pinVersion: pin.pinVersion,
    contentHash: pin.contentHash,
    byteLength: pin.byteLength,
    matched: true,
    mismatchDisposition: pin.mismatchDisposition
  },
  authorityClaim: 'ACQUISITION_TRACE_ONLY_NOT_RIGHTS_OR_SCIENTIFIC_AUTHORITY'
};
writeFileSync(join(OUTPUT_DIR, 'acquisition.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(evidence, null, 2));
