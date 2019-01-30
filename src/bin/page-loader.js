#!/usr/bin/env node
import pageloader from 'commander';
import { version } from '../../package.json';
import loadPage from '..';

pageloader
  .version(version)
  .description('Loads web pades to local storage.')
  .option('-o, --output [dir]', 'Output directory')
  .arguments('<pageUrl>')
  .action((pageUrl) => {
    loadPage(pageloader.output, pageUrl)
      .catch((err) => {
        const { message } = err;
        console.error(message);
        process.exit(-1);
      });
  })
  .parse(process.argv);
