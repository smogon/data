import path from 'path';
import fs from 'fs';
import psImport from '../ps-import';
import { GENERATIONS } from '../gens';
// @ts-ignore
import detStringify from 'json-stringify-deterministic';

const [, , psDataDir, exportDir] = process.argv;

if (psDataDir === undefined || exportDir === undefined) {
  console.error('convert-ps-data <ps data dir> <export dir>');
  process.exit(1);
}

const data = psImport(psDataDir);

for (const gen of GENERATIONS) {
  const genData = data.gens[gen];
  fs.writeFileSync(path.join(exportDir, `${gen}.json`), detStringify(genData, { space: '  ' }));
}
