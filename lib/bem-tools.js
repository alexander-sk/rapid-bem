'use strict';

const 
  bemPath = require('@intervolga/bem-utils').bemPath,
  fs = require('fs'),
  path = require('path'),
  console = require('console'),
  randomString = require('randomstring'),
  mkdirp = require('mkdirp'),
  parse = require('pug-parser'),
  lex = require('pug-lexer'),
  load = require('pug-load'),
  originNaming = require('@bem/sdk.naming.presets/origin'),
  bemParse = require('@bem/sdk.naming.entity.parse')(originNaming),
  wrap = require('pug-runtime/wrap'),
  pugCodeGen = require('pug-code-gen'),
  link = require('pug-linker'),
  sep = path.sep;

module.exports = class BemTools {
  constructor(config) {
    this.levels = config.levels;
    this.production = config.production;
    this.splitChunks = config.splitChunks;
    this.entities = {};
    this.templates = {};
    this.templatesDir = config.srcDir + '/templates/';
    this.bundles = {};

    let bindWrapper = function (entity) {
      return this.entities[entity].pugRaw;
    };
    bindWrapper = bindWrapper.bind(this);

    // Mod original function to be able process BEM entities.
    parse.Parser.prototype.parseInclude = function () {
      var tok = this.expect('include');
      var node = {
        type: 'Include',
        file: {
          type: 'FileReference',
          filename: this.filename
        },
        line: tok.loc.start.line,
        column: tok.loc.start.column,
        filename: this.filename
      };
      var filters = [];
      while (this.peek().type === 'filter') {
        filters.push(this.parseIncludeFilter());
      }
      var path = this.expect('path');

      node.file.path = path.val.trim();
      node.file.line = path.loc.start.line;
      node.file.column = path.loc.start.column;

      if (bindWrapper(node.file.path) || /\.pug$/.test(node.file.path) && !filters.length) {
        node.block = 'indent' == this.peek().type ? this.block() : this.emptyBlock(tok.loc.start.line);
      } 
      else {
        node.type = 'RawInclude';
        node.filters = filters;
        if (this.peek().type === 'indent') {
          this.error('RAW_INCLUDE_BLOCK', 'Raw inclusion cannot contain a block', this.peek());
        }
      }

      return node;
    };
  }
  
  /**
   * Load and concatenate giving files.
   * @param {Array} files files.
   * @returns {String} concatenated data.
   */
  loadFilesConcat(files) {
    let concatData = '';

    if (files && Array.isArray(files)) {
      files.forEach(file => {
        concatData += `${fs.readFileSync(file)}\n`;
      });
    }
    else {
      concatData = null;
    }

    return concatData;
  }

  /**
   * Resolve entity techs on fs.
   * @param {String} entity BEM entity.
   * @param {Array} levels redefinition levels.
   * @param {Array} techs techs extensions.
   * @returns {Object} entity data.
   */
  resolveEntityOnFs(entity, levels, techs) {
    let 
      bemEntity = bemParse(entity),
      entityData = { bemEntity: bemEntity };

    levels.forEach(level => {
      techs.forEach(tech => {
        let path = bemPath(bemEntity, tech, level);

        if (fs.existsSync(path)) {
          if (!entityData[tech])
            entityData[tech] = [];

          entityData[tech].push(path);
        }
      });
    });

    return entityData;
  }

  /**
   * Build if not exists or rebuild entity CSS.
   * @param {String} entity BEM entity.
   */
  buildBemEntityCss(entity) {
    if(!this.entities[entity]) {
      this.entities[entity] = this.buildBemEntity(entity);
    }
    else {
      let 
        entityData = this.resolveEntityOnFs(entity, this.levels, ['css']),
        cssConcat = this.loadFilesConcat(entityData.css);

      this.entities[entity].css = cssConcat;
    }
  }

  /**
   * Build if not exists or rebuild entity JS.
   * @param {String} entity BEM entity.
   */
  buildBemEntityJs(entity) {
    if(!this.entities[entity]) {
      this.entities[entity] = this.buildBemEntity(entity);
    }
    else {
      let 
        entityData = this.resolveEntityOnFs(entity, this.levels, ['js']),
        jsConcat = this.loadFilesConcat(entityData.js);

      this.entities[entity].js = jsConcat;
    }
  }

  /**
   * Build if not exists or rebuild entity images.
   * @param {String} entity BEM entity.
   * @return {Object} images.
   */
  buildBemEntityImages(entity) {
    const
      img = this.resolveEntityImagesOnFs(entity);

    this.entities[entity].img = img;

    return img;
  }

  /**
   * Build if not exists or rebuild entity fonts.
   * @param {String} entity BEM entity.
   * @return {Object} fonts.
   */
  buildBemEntityFonts(entity) {
    const
      fonts = this.resolveEntityFontsOnFs(entity);

    this.entities[entity].fonts = fonts;

    return fonts;
  }

  /**
   * Build if not exists or rebuild entity template, also extract dependencies.
   * @param {String} entity BEM entity.
   */
  buildBemEntityTemplate(entity) {
    if(!this.entities[entity]) {
      this.entities[entity] = this.buildBemEntity(entity);
    }
    else {
      let 
        entityData = this.resolveEntityOnFs(entity, this.levels, ['pug']),
        pugConcat = this.loadFilesConcat(entityData.pug),
        pugTokens = pugConcat ? lex(pugConcat) : null;

      this.entities[entity].pugRaw = pugConcat ? this.addPrivatePrefix(pugConcat) : null;
      this.entities[entity].pugTokens = pugTokens;
      this.entities[entity].deps = pugTokens ? this.depsFromTokens(pugTokens) : null;
    }
  }

  /**
   * Scan entity "img" directory on all redefinition levels.
   * @param {String} entity BEM entity.
   * @returns {Object} { file: '...path...'}, with respect redefinition levels.
   */
  resolveEntityImagesOnFs(entity) {
    let
      bemEntity = bemParse(entity),
      images = {};

    this.levels.forEach(level => {
      let 
        imgDir = path.dirname(bemPath(bemEntity, null, level)) + sep + 'img';

      if(fs.existsSync(imgDir)) {
        fs.readdirSync(imgDir).forEach(item => {
          images[item] = imgDir + sep + item;
        });
      }
    });

    return images;
  }

  /**
   * Scan entity "fonts" directory on all redefinition levels.
   * @param {String} entity BEM entity.
   * @returns {Object} { file: '...path...'}, with respect redefinition levels.
   */
  resolveEntityFontsOnFs(entity) {
    let
      bemEntity = bemParse(entity),
      fonts = {};

    this.levels.forEach(level => {
      let 
        fontsDir = path.dirname(bemPath(bemEntity, null, level)) + sep + 'fonts';

      if(fs.existsSync(fontsDir)) {
        fs.readdirSync(fontsDir).forEach(item => {
          fonts[item] = fontsDir + sep + item;
        });
      }
    });
    
    return fonts;
  }

  /**
   * Resolve entity on FS and returns all corresponding data.
   * @param {String} entity BEM entity.
   * @returns {Object} entity data.
   */
  buildBemEntity(entity) {
    let 
      entityData = this.resolveEntityOnFs(
        entity, 
        this.levels, 
        ['css', 'js', 'pug']
      ),
      pugConcat = this.loadFilesConcat(entityData.pug),
      cssConcat = this.loadFilesConcat(entityData.css),
      jsConcat = this.loadFilesConcat(entityData.js),
      pugTokens = pugConcat ? lex(pugConcat) : null,
      img = this.resolveEntityImagesOnFs(entity),
      fonts = this.resolveEntityFontsOnFs(entity);
    
    if
    (
      !cssConcat && 
      !jsConcat && 
      !pugConcat &&
      Object.keys(img).length === 0 &&
      Object.keys(fonts).length === 0
    ) {
      console.log(`Entity "${entity}" doesn't exists!`);
    };

    return {
      pugRaw: pugConcat ? this.addPrivatePrefix(pugConcat) : null,
      pugTokens: pugTokens,
      deps: pugTokens ? this.depsFromTokens(pugTokens) : null,
      css: cssConcat,
      js: jsConcat,
      img: img,
      fonts: fonts
    };
  }

  /**
   * Add arbitrary prefix for all mixins and calls that begin with "_".
   * @param {string} pugSource entity content from all levels.
   * @returns {string} processed source.
   */
  addPrivatePrefix(pugSource) {
    let 
      prefix = randomString.generate(5),
      content = pugSource;

    content = content.replace(/mixin _/g, ('mixin ' + prefix + '_'));
    content = content.replace(/\+_/g, ('+' + prefix + '_'));

    return content;
  }

  /**
   * Extract entities from pug tokens.
   * @param {Array} tokens pug tokens.
   * @returns {Array} dependencies.
   */
  depsFromTokens(tokens) {
    let 
      deps = [],
      // Prevent process entity twice as include and as token, i.e:
      // include block
      // ...
      // +block
      procTokens = [];

    tokens.forEach((token) => {
      if (token.type == 'class' || token.type == 'call') {
        // Ignore "local" tokens.
        if (token.val[0] != '_') {
          if (!procTokens.includes(token.val)) {
            deps.push([token.val, 'token']);
            procTokens.push(token.val);
          }
        }
      }
      if (token.type == 'path') {
        if (!procTokens.includes(token.val)) {
          deps.push([token.val, 'include']);
          procTokens.push(token.val);
        }
      }
    });

    return deps;
  }

  /**
   * Recursively calculate and build dependencies for entity if it is not exists.
   * @param {String} entity BEM entity.
   * @returns {Boolean} entity existence status.
   */
  entityDepsRecursive(entity) {
    let isExists = true;

    if (!this.entities.hasOwnProperty(entity)) {
      isExists = false;
      this.entities[entity] = this.buildBemEntity(entity);

      if (this.entities[entity].deps) {
        this.entities[entity].deps.forEach(entity => {
          this.entityDepsRecursive(entity[0]);
        });
      }
    }

    return isExists;
  }

  /**
   * Search templates depending on entity.
   * @param {String} entity BEM entity.
   * @returns {Array} templates list.
   */
  templatesByEntity(entity) {
    let templatesList = [];

    for (let template in this.templates) {
      this.templates[template].entitiesChain.forEach(record => {
        if(record[0] == entity) {
          templatesList.push(template);
        }
      });
    }

    return templatesList;
  }

  /**
   * Build template.
   * @param {String} file .pug template.
   */
  buildTemplate(file) {
    let 
      templateRaw = fs.readFileSync(file).toString(),
      tokens = lex(templateRaw),
      deps = this.depsFromTokens(tokens),
      templateName = path.basename(file, '.pug');

    this.templates[templateName] = {
      pugTokens: tokens,
      deps: deps, // 1st level deps
      pugRaw: templateRaw,
      entitiesChain: [], // all deps
    };

    deps.forEach((entity) => {
      this.entityDepsRecursive(entity[0]);
    });

    this.entitiesOrderFromDeps(
      deps,
      this.templates[templateName].entitiesChain
    );
  }

  /**
   * Recursively calculate dependencies for giving entities. 
   * Builds entity if necessary.
   * @param {Array} entities entities.
   * @param {Array} entitiesOrder dependencies in reverse order of first appearance.
   */
  entitiesOrderFromDeps(entities, entitiesOrder) {
    if(!entities)
      return;

    entities.forEach(entity => {
      // Compare entity string representation.
      if (!entitiesOrder.some(el => el[0] === entity[0])) {
        entitiesOrder.unshift(entity);

        if(!this.entities.hasOwnProperty(entity[0])) {
          this.entities[entity[0]] = this.buildBemEntity(entity[0]);
        }
        
        if (this.entities[entity[0]].hasOwnProperty('deps')) {
          this.entitiesOrderFromDeps(this.entities[entity[0]].deps, entitiesOrder);
        }
      }
    });
  }

  /**
   * @param {String} entity BEM entity.
   * @return {Bool}
   */
  isEntityInBundle(entity) {
    return this.bundles.hasOwnProperty(entity);
  }

  /**
   * Calculate bundle for every template.
   */
  calculateBundles() {
    this.bundles = {};

    for(let template in this.templates) {
      this.templates[template].entitiesChain.forEach(entity => {
        if(!this.bundles.hasOwnProperty(entity[0])) {
          this.bundles[entity[0]] = {
            refs: [],
            isVendor: false,
          };
        }

        if(!this.bundles[entity[0]].refs.includes(template))
          this.bundles[entity[0]].refs.push(template);

        if(this.splitChunks.vendorBlocks.includes(entity[0]))
          this.bundles[entity[0]].isVendor = true;
      });
    }
  }

  /**
   * Render CSS for entity or all bundle if entity not set.
   * @param {(String|undefined)} entity BEM entity.
   * @returns {Object} { filename: '...content...' }
   */
  renderCss(entity) {
    let cssBundle = {};

    if (!entity) {
      for (entity in this.entities) {
        if (this.entities[entity].css) {
          if(!this.splitChunks.cssSplit) {
            if(!cssBundle.hasOwnProperty('main'))
              cssBundle['main'] = '';

            cssBundle['main'] += `${this.entities[entity].css}\n`;
          }
          else {
            // Check status, because entity can exists but doesn't
            // have references in bundles.
            if(!this.isEntityInBundle(entity))
              continue;

            if(this.bundles[entity].refs.length >= this.splitChunks.minChunks) {
              if(!cssBundle.hasOwnProperty('common'))
                cssBundle['common'] = '';

              cssBundle['common'] += this.entities[entity].css;
            }
            else {
              this.bundles[entity].refs.forEach(template => {
                if(!cssBundle.hasOwnProperty(template))
                  cssBundle[template] = '';

                cssBundle[template] += this.entities[entity].css;
              });
            }
          }
        }
      }
    }
    else {
      cssBundle[entity] = '';

      if (this.entities[entity].css)
        cssBundle[entity] = `${this.entities[entity].css}\n`;
    }
    
    return cssBundle;
  }
  
  /**
   * Render JS for entity or all bundle if entity not set.
   * @param {(string|undefined)} entity BEM entity.
   * @returns {Object} { filename: '...content...' }
   */
  renderJs(entity) {
    let jsBundle = {};

    if (!entity) {
      for (entity in this.entities) {
        if (this.entities[entity].js) {
          if(!this.splitChunks.jsSplit) {
            if(!jsBundle.hasOwnProperty('main'))
              jsBundle['main'] = '';

            jsBundle['main'] += `${this.entities[entity].js}\n`;
          }
          else {
            // Check status, because entity can exists but doesn't
            // have references in bundles.
            if(!this.isEntityInBundle(entity))
              continue;

            if(this.bundles[entity].refs.length >= this.splitChunks.minChunks) {
              if(!jsBundle.hasOwnProperty('common'))
                jsBundle['common'] = '';

              jsBundle['common'] += this.entities[entity].js;
            }
            else {
              this.bundles[entity].refs.forEach(template => {
                if(!jsBundle.hasOwnProperty(template))
                  jsBundle[template] = '';

                jsBundle[template] += this.entities[entity].js;
              });
            }
          }
        }
      }
    }
    else {
      jsBundle[entity] = '';

      if (this.entities[entity].css)
        jsBundle[entity] = `${this.entities[entity].js}\n`;
    }
    
    return jsBundle;
  }

  /**
   * Remove template from internal structure.
   * @param {String} file template path.
   */
  unlinkTemplate(file) {
    let templateName = path.basename(file, '.pug');

    delete this.templates[templateName];
  }

  /**
   * Checks the implementation of the entity in at least one technology.
   * @param {String} entity BEM entity.
   * @returns {Boolean} entity existence.
   */
  isEntityExists(entity) {
    if(!this.entities.hasOwnProperty(entity))
      return false;
    
    if
    (
      !this.entities[entity].css && 
      !this.entities[entity].js && 
      !this.entities[entity].pugRaw &&
      Object.keys(this.entities[entity].img).length === 0 &&
      Object.keys(this.entities[entity].fonts).length === 0
    ) {
      return false;
    }

    return true;
  }

  /**
   * Render specific template.
   * @param {String} templateName name without extension.
   * @returns {Object} { name:'...', html: '...' }
   */
  renderTemplate(templateName) {
    let 
      entitiesOrder = this.templates[templateName].entitiesChain,
      templateAst = {},
      pugRaw = '',
      code = {},
      render = {},
      bindWrapper = {};

    entitiesOrder.forEach(entity => {
      // Create includes from class and mixins.
      if (this.entities[entity[0]].pugRaw && entity[1] == 'token') {
        pugRaw += `include ${entity[0]}\n`;
      }
    });

    pugRaw += `${this.templates[templateName].pugRaw}\n`;

    bindWrapper = function (filename) {
      if(this.isEntityExists(filename)) {
        // Return empty string if no pug for entity.
        if(this.entities[filename].pugRaw)
          return this.entities[filename].pugRaw;
        else
          return '';
      }
      else {
        console.log(`Error build "${templateName}", entity "${filename}" doesn't exists!\n`);
        return '';
      }
    };
    bindWrapper = bindWrapper.bind(this);

    templateAst = load.string(pugRaw, {
      lex: lex,
      parse: parse,
      resolve: function (includeName) {
        return includeName;
      },
      read: function (includeName) {
        return bindWrapper(includeName);
      },
    });

    link(templateAst);

    code = pugCodeGen(templateAst, {
      compileDebug: false,
      pretty: false,
      inlineRuntimeFunctions: false,
      templateName: templateName
    });

    render = wrap(code, templateName);

    return {
      name: templateName,
      html: render(),
    };
  }

  /**
   * Render all templates.
   * @returns {Array} array of { name:'...', html: '...' }
   */
  renderTemplates() {
    let 
      templatesArr = [],
      dirs = fs.readdirSync(this.templatesDir);

    dirs.forEach((file) => {
      if (file.includes('.pug')) {
        this.buildTemplate((this.templatesDir + file));
        templatesArr.push(this.renderTemplate(path.basename(file, '.pug')));
      }
    });

    return templatesArr;
  }

  /**
   * Concatenate all levels with a given path.
   * @param {String} path relative path.
   * @returns {Array}
   */
  buildLevelsPath(path) {
    let levelPath = [];

    this.levels.forEach(level => {
      levelPath.push(level + path);
    });

    return levelPath;
  }

  /**
   * Create entity for last redefinition level. 
   * Also adds default content for tech.
   * @param {String} entity BEM entity.
   * @param {String} techs format: js,css,pug.
   */
  createEntityOnFs(entity, techs) {
    let 
      techsList = ['css', 'js', 'pug'],
      level = this.levels[this.levels.length - 1];
  
    techs.split(',').forEach(tech => {
      if (techsList.includes(tech)) {
        let entityPath = bemPath(
          bemParse(entity),
          tech,
          level // Create entity only for last level.
        );
  
        mkdirp(path.dirname(entityPath), (err) => {
          if (err) {
            throw err;
          }
          else {
            if (fs.existsSync(entityPath)) {
              console.log(`File '${entityPath}' exists!`);
            }
            else {
              let content = '';
  
              switch (tech) {
                case 'css':
                  content = `.${entity} {\n\t\n}`;
                  break;
                case 'js':
                  break;
                case 'pug':
                  content = `//- ${entity} \n\n`;
                  break;
              }
  
              fs.appendFile(entityPath, content, (err) => {
                if (err) {
                  throw err;
                }
                else {
                  console.log(`File '${entityPath}' created.`);
                }
              });
            }
          }
        });
      }
      else {
        console.log(`Unknown tech '${tech}'.`);
      }
    });
  }
};