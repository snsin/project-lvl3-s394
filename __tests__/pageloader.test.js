import nock from 'nock';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';
import { head, tail } from 'lodash';
import loadPage from '../src';

const createResoursesTuples = (resoursesDir, resoursesPaths) => resoursesPaths
  .map((resPath) => {
    const fileName = tail(resPath.split('/')).join('-');
    return [resPath, join(resoursesDir, fileName)];
  });

const fixtures = {};

const getResoursePath = path => fixtures.resourses
  .find(({ urlPath }) => urlPath === path).urlPath;

const getResourseData = path => fixtures.resourses
  .find(({ urlPath }) => urlPath === path).data;

const createUrlByPath = (path) => {
  const resultUrl = new URL(fixtures.url.origin);
  resultUrl.pathname = path;
  return resultUrl;
};

beforeAll(async () => {
  nock.disableNetConnect();
  fixtures.url = new URL('https://jestjs.io');
  const fixtureDir = '__tests__/__fixtures__/';
  fixtures.localHtmlData = await fs.readFile(join(fixtureDir, 'localized.html'));
  const pathFileTuples = [
    ['/en/help', 'jestjs-io-en-help.html'],
    ...createResoursesTuples('jestjs-io-en-help_files',
      [
        '/img/favicon/favicon.ico',
        '/css/main.css',
        '/js/codetabs.js',
        '/img/jest.svg',
        '/img/language.svg',
        '/img/jest-outline.svg',
        '/img/oss_logo.png',
      ]),
  ];
  const resousesData = await Promise.all(
    pathFileTuples.map(([, filePath]) => fs.readFile(join(fixtureDir, filePath))),
  );
  fixtures.resourses = pathFileTuples
    .map((tuple, i) => [...tuple, resousesData[i]])
    .map(([urlPath, filePath, data]) => ({ urlPath, filePath, data }));
});

beforeEach(async () => {
  fixtures.targetDir = await fs.mkdtemp(join(os.tmpdir(), 'page-load-'));
});


test('load data to files', async () => {
  nock(fixtures.url.origin)
    .get(path => getResoursePath(path))
    .times(fixtures.resourses.length)
    .reply(200, (path) => {
      const data = getResourseData(path);
      return data;
    });

  const {
    urlPath: urlRootHtmlPath,
    filePath: createdRootHtmlPath,
  } = head(fixtures.resourses);
  const targetUrl = createUrlByPath(urlRootHtmlPath);
  await loadPage(targetUrl.href, fixtures.targetDir);
  const createdHtmlData = await fs.readFile(
    join(fixtures.targetDir, createdRootHtmlPath),
    'utf8',
  );
  expect(createdHtmlData).toBe(fixtures.localHtmlData.toString());

  const resoursesData = await Promise.all(tail(fixtures.resourses)
    .map(({ filePath }) => fs.readFile(join(fixtures.targetDir, filePath))));
  resoursesData.forEach((data, i) => {
    expect(Buffer.compare(data, tail(fixtures.resourses)[i].data)).toBe(0);
  });
});

test('page not found', async () => {
  nock(fixtures.url.origin)
    .get(path => getResoursePath(path))
    .reply(404);
  const targetUrl = createUrlByPath(head(fixtures.resourses).urlPath);
  await expect(loadPage(targetUrl.href, fixtures.targetDir))
    .rejects.toThrow('404');
});

test('directory not exist', async () => {
  nock(fixtures.url.origin)
    .get(path => getResoursePath(path))
    .times(fixtures.resourses.length)
    .reply(200, path => getResourseData(path));
  const targetUrl = createUrlByPath(head(fixtures.resourses).urlPath);
  await expect(loadPage(targetUrl.href, join(fixtures.targetDir, 'not-exist')))
    .rejects.toThrow('ENOENT');
});
