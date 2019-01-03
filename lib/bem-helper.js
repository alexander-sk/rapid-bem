'use strict';

const
  console = require('console'),
  config = require('../config'),
  BemTools = require('./bem-tools'),
  bt = new BemTools(config);

if (!process.env.npm_config_e || !process.env.npm_config_t)
  console.log('Args error, usage: "npm run add --e=block__elem_mod --t=js,css,pug"');
else
  bt.createEntityOnFs(process.env.npm_config_e, process.env.npm_config_t);