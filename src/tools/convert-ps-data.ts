import path from 'path';
import fs from 'fs';
import psImport from '../ps-import';
// @ts-ignore
import detStringify from 'json-stringify-deterministic';

const [, , psDataDir, exportDir] = process.argv;

if (psDataDir === undefined || exportDir === undefined) {
  console.error('convert-ps-data <ps data dir> <export dir>');
  process.exit(1);
}

const data = psImport(psDataDir);

fs.mkdirSync(exportDir, { recursive: true });
for (const gen of data.gens) {
  if (gen === null) continue;
  fs.writeFileSync(path.join(exportDir, `${gen.num}.json`), detStringify(gen, { space: '  ' }));
}
