#!/usr/bin/env node
import pageloader from 'commander';
import { version } from '../../package.json';
import loadPage from '..';

pageloader
  .version(version)
  .description('Loads web pades to local storage.')
  .option('-o, --output [dir]', 'Output directory', process.cwd())
  .arguments('<pageUrl>')
  .action((pageUrl) => {
    loadPage(pageUrl, pageloader.output)
      .catch((err) => {
        const { message, code } = err;
        console.error(message);
        process.exit(code);
      });
  })
  .parse(process.argv);
