import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import cheerio from 'cheerio';
import { findKey, has } from 'lodash';
import debug from 'debug';
import Listr from 'listr';

const loggingName = 'page-loader:';
const log = debug(`${loggingName}log`);
const err = debug(`${loggingName}err`);
const spec = debug(`${loggingName}spc`);


const createFileName = (pageUrl, ending = '') => {
  const { hostname, pathname } = new URL(pageUrl);
  const pathParts = pathname.split('/').filter(w => w.length > 0);
  const hostParts = hostname.split('.');
  return `${[...hostParts, ...pathParts].join('-')}${ending}`;
};

const errorTypeSelector = {
  syscall: e => `System error: ${e.message}`,
  response: e => `Network error: ${e.message} ${e.config.url}`,
  unknown: e => `Unknown error: ${e.message}`,
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

const addSpinnersToTasks = (resourses, tasks, pageUrl) => resourses
  .forEach(({ url, filename }) => {
    const resUrl = new URL(pageUrl);
    resUrl.pathname = url;
    spec('spinner %s', resUrl);
    tasks.add(
      {
        title: `Loading ${resUrl.href}`,
        task: ctx => axios({ method: 'get', url: resUrl.href, responseType: 'stream' })
          .then((resp) => { ctx[filename] = resp; }),
      },
    );
  });

const createResoursesWriteList = (responses, dir) => Object.keys(responses)
  .map((filename) => {
    const filepath = path.join(dir, filename);
    return responses[filename].data.pipe(createWriteStream(filepath));
  });


const loadPage = (pageUrl, targetDir) => {
  log('start %o', loggingName);
  log('params: url - %s ; target directory - %s', pageUrl, targetDir);
  let $;
  let resourses;
  const resoursesDirName = createFileName(pageUrl, '_files');
  const resoursesDirPath = path.join(targetDir, resoursesDirName);
  return fs.mkdir(resoursesDirPath)
    .then(() => {
      log('resourses directory created: %s', resoursesDirPath);
      return axios.get(pageUrl);
    })
    .then((htmlResp) => {
      log('response recieved from %s status: %d', pageUrl, htmlResp.status);
      $ = cheerio.load(htmlResp.data);
      resourses = getLocalResouses($);
      log('resourses list created:\n%O', resourses);
      const tasks = new Listr({ concurrent: true });
      addSpinnersToTasks(resourses, tasks, pageUrl);
      spec('Listr tasks\n%O', tasks);
      return tasks.run();
    })
    .then((responsesObject) => {
      log('all resourses recieved, got %d data sets', Object.keys(responsesObject).length);
      return Promise.all(
        createResoursesWriteList(responsesObject, resoursesDirPath, resourses),
      );
    })
    .then(() => {
      log('resourses files written:\n%O', resourses.map(({ filename }) => filename));
      resourses.forEach(({ node, attrname, filename }) => {
        node.attr(attrname, path.join(resoursesDirName, filename));
      });
      const resultHtmlPath = path.join(targetDir, createFileName(pageUrl, '.html'));
      log('writing result html started: %s', resultHtmlPath);
      return fs.writeFile(resultHtmlPath, $.html(), 'utf8');
    })
    .then(() => {
      log('all OK: %s downloaded to %s', pageUrl, targetDir);
    })
    .catch((e) => {
      err('error thrown\n%O', e);
      throw new Error(createMessage(e));
    });
};

export default loadPage;
