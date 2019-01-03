'use strict';

const 
  gulp = require('gulp'),
  watch = require('gulp-watch'),
  nodePath = require('path'),
  fs = require('fs'),
  del = require('del'),
  copy = require('copy'),
  console = require('console'),
  gulpFile = require('gulp-file'),
  browserSync = require('browser-sync'),
  reload = browserSync.reload,
  BemTools = require('./lib/bem-tools'),
  config = require('./config'),
  bt = new BemTools(config),
  sep = nodePath.sep,

  path = {
    build: {
      templates: './build',
      js: './build/js/',
      css: './build/css/',
      img: './build/img/',
      fonts: './build/fonts/'
    },
    src: {
      pug: bt.buildLevelsPath('/**/*.pug'),
      templates: config.srcDir + '/templates/*.pug',
      templatesStatic: config.srcDir + '/templates/static/*',
      js: bt.buildLevelsPath('/**/*.js'),
      style: bt.buildLevelsPath('/**/*.css'),
      img: bt.buildLevelsPath('/**/img/**/*.*'),
      fonts: bt.buildLevelsPath('/**/fonts/**/*.*')
    },
    clean: './build',
  },

  pipe = {
    js: function (fileName, src) {
      return gulpFile(fileName, src, { src: true })
        .pipe(gulp.dest(path.build.js))
        .pipe(reload({stream:true}));
    },
    css: function (fileName, src) {
      return gulpFile(fileName, src, { src: true })
        .pipe(gulp.dest(path.build.css))
        .pipe(reload({stream:true}));
    },
    templates: function (fileName, src) {
      return gulpFile(fileName, src, { src: true })
        .pipe(gulp.dest(path.build.templates))
        .pipe(reload({stream:true}));
    },
    img: function (fileName, src) {
      return gulpFile(fileName, src, { src: true })
        .pipe(gulp.dest(path.build.img))
        .pipe(reload({stream:true}));
    },
    fonts: function (fileName, src) {
      return gulpFile(fileName, src, { src: true })
        .pipe(gulp.dest(path.build.fonts))
        .pipe(reload({stream:true}));
    },
  },

  imgFontsBuild = function() {
    for(let entity in bt.entities) {
      if(bt.isEntityInBundle(entity)) {
        for(let imgName in bt.entities[entity].img) {
          pipe.img(
            imgName,
            fs.readFileSync(bt.entities[entity].img[imgName])
          );
        }
    
        for(let fontName in bt.entities[entity].fonts) {
          pipe.fonts(
            fontName,
            fs.readFileSync(bt.entities[entity].fonts[fontName])
          );
        }
      }
    }
  },

  buildBundle = function() {
    let 
      cssBundle = {},
      jsBundle = {};

    bt.calculateBundles();

    cssBundle = bt.renderCss();
    for(let record in cssBundle) {
      pipe.css(
        record + '.css',
        cssBundle[record]
      );
    }

    jsBundle = bt.renderJs();
    for(let record in jsBundle) {
      pipe.js(
        record + '.js',
        jsBundle[record]
      );
    }
  },

  rebuildBundle = function() {
    del.sync([path.build.css]);
    del.sync([path.build.js]);
    del.sync([path.build.img]);
    del.sync([path.build.fonts]);

    buildBundle();
    imgFontsBuild();
  },

  // Work only for img/fonts.
  entityFromPath = function(path) {
    const
      dirName = nodePath.dirname(path),
      pathSegments = dirName.split(sep);

    return pathSegments[pathSegments.length - 2];
  };

gulp.task('build', function (cb) {
  del.sync([path.clean + sep + '*']);

  bt.renderTemplates().forEach(template => {
    pipe.templates(
      template.name + '.html', 
      template.html
    );
  });

  buildBundle();
  imgFontsBuild();
  copy(path.src.templatesStatic, path.build.templates, cb);
});

gulp.task('watch', function () {
  // Templates watcher.
  watch([path.src.templates], { read: false, usePolling: true, awaitWriteFinish: true })
    .on('add', file => {
      bt.buildTemplate(file);
    })
    .on('change', file => {
      const 
        templateName = nodePath.basename(file, '.pug');

      console.log(`Template "${templateName}" changed.`);

      bt.buildTemplate(file);
      pipe.templates(
        templateName + '.html', 
        bt.renderTemplate(templateName).html
      );

      rebuildBundle();
    })
    .on('unlink', file => {
      const 
        templateName = nodePath.basename(file, '.pug'),
        renderedPath = path.build.templates + '/' + templateName + '.html';

      bt.unlinkTemplate(file);
      fs.unlink(renderedPath, function (err) {
        if (err) throw err;
        console.log(`Template ${renderedPath} deleted.`);
      });
    });

  // Templates static data watcher.
  watch(path.src.templatesStatic, { read: false, usePolling: true, awaitWriteFinish: true })
    .on('add', file => {
      const
        fileName = nodePath.basename(file);

      fs.createReadStream(file).pipe(fs.createWriteStream(path.build.templates + sep + fileName));
    })
    .on('change', file => {
      const
        fileName = nodePath.basename(file);

      fs.createReadStream(file).pipe(fs.createWriteStream(path.build.templates + sep + fileName));
    })
    .on('unlink', file => {
      const
        fileName = nodePath.basename(file);

      del([path.build.templates + sep + fileName]);
    });

  // Entity templates watcher.
  watch(path.src.pug, { read: false, usePolling: true, awaitWriteFinish: true })
    .on('add', file => {
      const 
        entity = nodePath.basename(file, '.pug');
        
      if(bt.isEntityInBundle(entity)) {
        bt.buildBemEntity(entity);
      }
    })
    .on('change', file => {
      const 
        entity = nodePath.basename(file, '.pug');

      if(bt.isEntityInBundle(entity)) {
        console.log(`Entity "${entity}" template changed.`);

        bt.buildBemEntityTemplate(entity);
        bt.templatesByEntity(entity).forEach(template => {
          bt.buildTemplate(config.srcDir + '/templates/' + template + '.pug');
          pipe.templates(
            template + '.html', 
            bt.renderTemplate(template).html
          );
        });

        rebuildBundle();
      }
    });

  // Entity CSS watcher.
  watch(path.src.style, { read: false, usePolling: true, awaitWriteFinish: true })
    .on('change', file => {
      const 
        entity = nodePath.basename(file, '.css');
      let 
        cssBundle = {};
      
      if(bt.isEntityInBundle(entity)) {
        console.log(`Entity "${entity}" CSS changed.`);

        del.sync([path.build.css + '*']);

        bt.buildBemEntityCss(entity);
        cssBundle = bt.renderCss();
        for(let record in cssBundle) {
          pipe.css(
            record + '.css',
            cssBundle[record]
          );
        }
      }
    });

  // Entity JS watcher.
  watch(path.src.js, { read: false, usePolling: true, awaitWriteFinish: true })
    .on('change', file => {
      const 
        entity = nodePath.basename(file, '.js');
      let 
        jsBundle = {};

      if(bt.isEntityInBundle(entity)) {
        console.log(`Entity "${entity}" JS changed.`);

        del.sync([path.build.js + '*']);

        bt.buildBemEntityCss(entity);
        jsBundle = bt.renderJs();
        for(let record in jsBundle) {
          pipe.js(
            record + '.js',
            jsBundle[record]
          );
        }
      }
    });

  // Entity img watcher.
  watch(path.src.img, { read: false, usePolling: true, awaitWriteFinish: true })
    .on('add', file => {
      const
        entity = entityFromPath(file),
        fileName = nodePath.basename(file);
      
      if(bt.isEntityInBundle(entity)) {
        let 
          img = bt.buildBemEntityImages(entity);

        pipe.img(
          fileName,
          fs.readFileSync(img[fileName])
        );
      }
    })
    .on('change', file => {
      const
        entity = entityFromPath(file),
        fileName = nodePath.basename(file);

      if(bt.isEntityInBundle(entity)) {
        pipe.img(
          fileName,
          fs.readFileSync(bt.entities[entity].img[fileName])
        );
      }
    })
    .on('unlink', file => {
      const
        entity = entityFromPath(file),
        fileName = nodePath.basename(file);
      
      if(bt.isEntityInBundle(entity)) {
        const 
          img = bt.buildBemEntityImages(entity);

        // Replace from other redefinition level or delete?
        if(img.hasOwnProperty(fileName)) {
          pipe.img(
            fileName,
            fs.readFileSync(img[fileName])
          );
        }
        else {
          del.sync([path.build.img + fileName]);
        }
      }
    });

  // Entity fonts watcher.
  watch(path.src.fonts, { read: false, usePolling: true, awaitWriteFinish: true })
    .on('add', file => {
      const
        entity = entityFromPath(file),
        fileName = nodePath.basename(file);
      
      if(bt.isEntityInBundle(entity)) {
        let 
          fonts = bt.buildBemEntityFonts(entity);

        pipe.fonts(
          fileName,
          fs.readFileSync(fonts[fileName])
        );
      }
    })
    .on('change', file => {
      const
        entity = entityFromPath(file),
        fileName = nodePath.basename(file);

      if(bt.isEntityInBundle(entity)) {
        pipe.fonts(
          fileName,
          fs.readFileSync(bt.entities[entity].fonts[fileName])
        );
      }
    })
    .on('unlink', file => {
      const
        entity = entityFromPath(file),
        fileName = nodePath.basename(file);
      
      if(bt.isEntityInBundle(entity)) {
        const 
          fonts = bt.buildBemEntityFonts(entity);

        // Replace from other redefinition level or delete?
        if(fonts.hasOwnProperty(fileName)) {
          pipe.fonts(
            fileName,
            fs.readFileSync(fonts[fileName])
          );
        }
        else {
          del.sync([path.build.fonts + fileName]);
        }
      }
    });
});

gulp.task('browserSync', function() {
  browserSync({
    server: {
      baseDir: path.build.templates
    },
    port: 8080,
    ui: false,
    open: 'local',
    notify: false,
    reloadOnRestart: true
  });
});

gulp.task('default', gulp.series('build', gulp.parallel('watch', 'browserSync')));