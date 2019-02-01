import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import cheerio from 'cheerio';
import { findKey, has } from 'lodash';

const createFileName = (pageUrl, ending = '') => {
  const { hostname, pathname } = new URL(pageUrl);
  const pathParts = pathname.split('/').filter(w => w.length > 0);

  const hostParts = hostname.split('.');
  return `${[...hostParts, ...pathParts].join('-')}${ending}`;
};

const errorTypeSelector = {
  syscall: e => e.message,
  response: e => `${e.message} ${e.config.url}`,
  unknown: e => `Unknown error ${e.message}`,
};

const createMessage = (e = { message: '' }) => {
  const errType = findKey(errorTypeSelector, fn => has(e, fn.name));
  return errType ? errorTypeSelector[errType](e) : errorTypeSelector.unknown(e);
};

const attrToTagTable = {
  img: 'src',
  link: 'href',
  script: 'src',
};

const localResourse = /^\/\w.*/; // matches local recourses

const loadPage = (pageUrl, targetDir) => {
  let $;
  let resourses;
  const resoursesDirName = createFileName(pageUrl, '_files');
  const resoursesDirPath = path.join(targetDir, resoursesDirName);
  return fs.mkdir(resoursesDirPath)
    .then(() => axios.get(pageUrl))
    .then((res) => {
      $ = cheerio.load(res.data);
      resourses = $('link,script,img').map((i, elem) => {
        const node = $(elem);
        const [{ name }] = node.get();
        const url = node.attr(attrToTagTable[name]);
        return { node, url };
      }).get().filter(({ url }) => localResourse.test(url));
      return Promise.all(resourses
        .map(({ url }) => {
          const resUrl = new URL(pageUrl);
          resUrl.pathname = url;
          return axios(/* {
            method: 'get',
            url: resUrl.href,
            responseType: 'stream',
          } */resUrl.href,
          );
        }));
    })
    .then(loadedResourses => Promise.all(loadedResourses
      // TODO implement create file name more intelligent
      .map((res, i) => fs.writeFile(
        path.join(targetDir, resoursesDirName, `${resourses[i].url.pathname}`), res, 'utf8',
      ))))
    .then(() => {
      const filePath = path.join(targetDir, createFileName(pageUrl, '.html'));
      return fs.writeFile(filePath, $.html(), 'utf8');
    })
    .catch((e) => {
      throw new Error(createMessage(e));
    });
};

export default loadPage;
