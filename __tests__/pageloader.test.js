import nock from 'nock';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';
import loadPage from '../src';

const fixtures = {};

beforeAll(async () => {
  nock.disableNetConnect();
  fixtures.filename = 'hexlet-io-courses.html';
  fixtures.url = new URL('https://hexlet.io/courses');
  const fixtureDir = '__tests__/__fixtures__/';
  fixtures.data = await fs.readFile(join(fixtureDir, fixtures.filename), 'utf8');
});

beforeEach(async () => {
  fixtures.targetDir = await fs.mkdtemp(join(os.tmpdir(), 'page-load-'));
});


test('load data to file', async () => {
  nock(fixtures.url.origin)
    .get(fixtures.url.pathname)
    .reply(200, fixtures.data);
  await loadPage(fixtures.url.href, fixtures.targetDir);
  const loadedData = await fs.readFile(join(fixtures.targetDir, fixtures.filename), 'utf8');
  expect(loadedData).toBe(fixtures.data);
});

test('page not found', async () => {
  nock(fixtures.url.origin)
    .get(fixtures.url.pathname)
    .reply(404);
  try {
    await loadPage(fixtures.url.href, fixtures.targetDir);
  } catch (e) {
    expect(e.message).toMatch('404');
  }
});

test('directory not exist', async () => {
  nock(fixtures.url.origin)
    .get(fixtures.url.pathname)
    .reply(200, fixtures.data);
  try {
    await loadPage(fixtures.url.href, join(fixtures.targetDir, 'not-exist'));
  } catch (e) {
    expect(e.message).toMatch('ENOENT');
  }
});
