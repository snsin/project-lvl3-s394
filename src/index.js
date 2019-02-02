import { createWriteStream, promises as fs } from 'fs';
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


const getLocalResouses = (dom) => {
  const localResourseRegexp = /^\/\w.*/; // matches local recourses paths
  const tagsString = Object.keys(attrToTagTable).join(',');
  return dom(tagsString)
    .map((i, elem) => {
      const node = dom(elem);
      const [{ name }] = node.get();
      const attrname = attrToTagTable[name];
      const url = node.attr(attrname);
      return { node, url, attrname };
    })
    .get()
    .filter(({ url }) => localResourseRegexp.test(url))
    .map((res) => {
      const filename = res.url.match(/[\w-.]+/g).join('-');
      return { ...res, filename };
    });
};

const getResousesRequests = (resourses, pageUrl) => resourses
  .map(({ url }) => {
    const resUrl = new URL(pageUrl);
    resUrl.pathname = url;
    return axios({
      method: 'get',
      url: resUrl.href,
      responseType: 'stream',
    });
  });

const createResoursesWriteList = (responses, dir, resourses) => responses
  .map((resp, i) => {
    const filepath = path.join(dir, resourses[i].filename);
    return resp.data.pipe(createWriteStream(filepath));
  });


const loadPage = (pageUrl, targetDir) => {
  let $;
  let resourses;
  const resoursesDirName = createFileName(pageUrl, '_files');
  const resoursesDirPath = path.join(targetDir, resoursesDirName);
  return fs.mkdir(resoursesDirPath)
    .then(() => axios.get(pageUrl))
    .then((htmlResp) => {
      $ = cheerio.load(htmlResp.data);
      resourses = getLocalResouses($);
      return Promise.all(getResousesRequests(resourses, pageUrl));
    })
    .then(responses => Promise.all(
      createResoursesWriteList(responses, resoursesDirPath, resourses),
    ))
    .then(() => {
      resourses.forEach(({ node, attrname, filename }) => {
        node.attr(attrname, path.join(resoursesDirName, filename));
      });
      const resultHtmlPath = path.join(targetDir, createFileName(pageUrl, '.html'));
      return fs.writeFile(resultHtmlPath, $.html(), 'utf8');
    })
    .catch((e) => {
      throw new Error(createMessage(e));
    });
};

export default loadPage;
