import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import { findKey, has } from 'lodash';

const createFileName = (pageUrl) => {
  const { hostname, pathname } = new URL(pageUrl);
  const pathParts = pathname.split('/').filter(w => w.length > 0);

  const hostParts = hostname.split('.');
  return `${[...hostParts, ...pathParts].join('-')}.html`;
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

const loadPage = (targetDir = process.cwd(), pageUrl) => axios.get(pageUrl)
  .then(res => res.data)
  .then((data) => {
    const filePath = path.join(targetDir, createFileName(pageUrl));
    return fs.writeFile(filePath, data, 'utf8');
  })
  .catch((e) => {
    const newErr = { ...e, message: createMessage(e) };
    throw newErr;
  });

export default loadPage;
