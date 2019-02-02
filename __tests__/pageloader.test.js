import nock from 'nock';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';
import { tail } from 'lodash';
import loadPage from '../src';

const fixtures = {};

const getResoursePath = path => fixtures.resourses
  .find(({ urlPath }) => urlPath === path)
  .urlPath;

const getResourseData = (path) => {
  const dataIndex = fixtures.resourses
    .findIndex(({ urlPath }) => urlPath === path);
  return fixtures.data[dataIndex];
};

beforeAll(async () => {
  nock.disableNetConnect();
  fixtures.url = new URL('https://jestjs.io/en/help');
  const fixtureDir = '__tests__/__fixtures__/';
  fixtures.localHtml = await fs.readFile(join(fixtureDir, 'localized.html'));
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
    {
      urlPath: '/js/codetabs.js',
      fsPath: 'jestjs-io-en-help_files/js-codetabs.js',
    },
    {
      urlPath: '/img/jest.svg',
      fsPath: 'jestjs-io-en-help_files/img-jest.svg',
    },
    {
      urlPath: '/img/language.svg',
      fsPath: 'jestjs-io-en-help_files/img-language.svg',
    },
    {
      urlPath: '/img/jest-outline.svg',
      fsPath: 'jestjs-io-en-help_files/img-jest-outline.svg',
    },
    {
      urlPath: '/img/oss_logo.png',
      fsPath: 'jestjs-io-en-help_files/img-oss_logo.png',
    },
  ];

  fixtures.data = await Promise.all(
    fixtures.resourses.map(({ fsPath }) => fs.readFile(join(fixtureDir, fsPath))),
  );
});

afterAll(() => {
  nock.cleanAll();
});

beforeEach(async () => {
  fixtures.targetDir = await fs.mkdtemp(join(os.tmpdir(), 'page-load-'));
});


test('load data to files', async () => {
  nock(fixtures.url.origin)
    .get(path => getResoursePath(path))
    .times(fixtures.resourses.length)
    .reply(200, path => getResourseData(path));

  await loadPage(fixtures.url.href, fixtures.targetDir);

  const ethalons = [fixtures.localHtml, ...tail(fixtures.data)];
  const loadedFiles = await Promise.all(fixtures.resourses
    .map(({ fsPath }) => fs.readFile(join(fixtures.targetDir, fsPath))));

  loadedFiles.forEach((file, i) => {
    expect(Buffer.compare(file, ethalons[i])).toBe(0);
  });
});

test('page not found', async () => {
  nock(fixtures.url.origin)
    .get(path => getResoursePath(path))
    .reply(404);
  await expect(loadPage(fixtures.url.href, fixtures.targetDir))
    .rejects.toThrow('404');
});

test('directory not exist', async () => {
  nock(fixtures.url.origin)
    .get(path => getResoursePath(path))
    .times(fixtures.resourses.length)
    .reply(200, path => getResourseData(path));
  await expect(loadPage(fixtures.url.href, join(fixtures.targetDir, 'not-exist')))
    .rejects.toThrow('ENOENT');
});
