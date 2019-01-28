import nock from 'nock';
import { promises as fs } from 'fs';
import { sep } from 'path';

beforeAll(() => fs.mkdtemp(`__tests__${sep}`));

test('it works', () => {
  expect(2 + 2).toBe(4);
});

/* nock('https://hexlet.io')
  .get('/courses')
  .reply(200, { currentTime: 36000 }); */
