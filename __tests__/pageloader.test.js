import nock from 'nock';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';
import { tail } from 'lodash';
import loadPage from '../src';

const fixtures = {};

beforeAll(() => {
  nock.disableNetConnect();
});

afterAll(() => {
  nock.cleanAll();
});

beforeEach(async () => {
  fixtures.targetDir = await fs.mkdtemp(join(os.tmpdir(), 'page-load-'));
});

describe('load data to files', () => {
  beforeAll(async () => {
    fixtures.url = new URL('https://jestjs.io/en/help');
    fixtures.fixtureDir = '__tests__/__fixtures__/';
    fixtures.localHtmlPath = 'localized.html';
    fixtures.resourses = [
      {
        urlPath: '/en/help',
        fsPath: 'jestjs-io-en-help.html',
      },
      {
        urlPath: '/img/favicon/favicon.ico',
        fsPath: 'jestjs-io-en-help_files/img-favicon-favicon.ico',
      },
      {
        urlPath: '/css/main.css',
        fsPath: 'jestjs-io-en-help_files/css-main.css',
      },
    ];
    fixtures.resourses.forEach(({ urlPath, fsPath }) => {
      nock(fixtures.url.origin)
        .get(urlPath)
        .replyWithFile(200, join(fixtures.fixtureDir, fsPath));
    });
    fixtures.data = await Promise.all(
      fixtures.resourses.map(({ fsPath }) => fs.readFile(join(fixtures.fixtureDir, fsPath))),
    );
  });

  test('should works', async () => {
    await loadPage(fixtures.url.href, fixtures.targetDir);

    const ethalons = await Promise.all(
      [fixtures.localHtmlPath, ...tail(fixtures.resourses).map(({ fsPath }) => fsPath)]
        .map(filepath => fs.readFile(join(fixtures.fixtureDir, filepath))),
    );
    const loadedFiles = await Promise.all(fixtures.resourses
      .map(({ fsPath }) => fs.readFile(join(fixtures.targetDir, fsPath))));

    loadedFiles.forEach((file, i) => {
      expect(file.toString('utf8')).toBe(ethalons[i].toString('utf8'));
    });
  });
});


test('page not found', async () => {
  nock(fixtures.url.origin)
    .get(/\/*/)
    .reply(404);
  return expect(loadPage(fixtures.url.href, fixtures.targetDir))
    .rejects.toThrow('404');
});

test('directory not exist', async () => {
  nock(fixtures.url.origin)
    .get(/\/*/)
    .times(fixtures.resourses.length)
    .reply(200, 'OK');
  return expect(loadPage(fixtures.url.href, join(fixtures.targetDir, 'not-exist')))
    .rejects.toThrow('ENOENT');
});
