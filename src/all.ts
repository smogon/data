import psImport from './ps-import';
import path from 'path';
import { loader } from './index';

export default loader
  .load(psImport(path.join(__dirname, '../vendor/Pokemon-Showdown/data')))
  .construct();
