import { validate } from '../validator';
import * as utils from './utils';
import { Log } from '../types';

const templates = {
  apispecifications: 'apiSpecifications.json',
  apispecs: 'apiSpecifications.json',
  config: 'config.json',
  endpoints: 'endpoints.json',
  ois: 'ois.json',
};

let template = process.env.npm_config_template || process.argv[2];
const specs = process.env.npm_config_specs || process.argv[3];
const version = process.env.npm_config_templateVersion || process.argv[4];

const messages: Log[] = [];

if (templates[template.toLowerCase() as keyof typeof templates]) {
  template = utils.getPath(templates[template.toLowerCase() as keyof typeof templates], messages, version);
} else if (version) {
  messages.push({
    level: 'warning',
    message: 'Version argument will be ignored when validating provided template file',
  });
}

if (specs && template) {
  const res = validate(specs, template);
  res.messages.push(...messages);
  console.log(JSON.stringify(res, null, '\t'));
}
