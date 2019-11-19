import psImport from './ps-import';
import path from 'path';
import { loader } from './index';

export const dex = loader
  .load(psImport(path.join(__dirname, '../vendor/Pokemon-Showdown/data')))
  .construct();
