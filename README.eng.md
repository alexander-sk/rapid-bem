# Rapid BEM

<p align="center">
  <a href="https://github.com/alexander-sk/rapid-bem/blob/master/README.md">Русский</a> |
  <span>English</span>
</p>

Frontend builder using the BEM methodology with support of redefinition levels, pug template engine and automatic markup-based dependency extraction.

## Contents

- [Benefits](#benefits)
- [Install](#install)
- [Basic concepts](#concepts)
- [Usage](#usage)
- [BEM helper](#bem-helper)
- [Configuration](#config)
- [Why not webpack?](#webpack)
- [Why not project-stub or ENB?](#yandex)
- [Why not just glue all using gulp?](#gulp)
- [Notes](#notes)

## <a name="benefits">Benefits</a>
- support pug template engine;
- automatic extraction of dependencies from classes and pug mixins;
- redefinition levels;
- bundle split(a.k.a. split chunks);
- rebuilding modified parts in "gulp-watch" mode;
- [BEM helper](#bem-helper) for easy creation of entities on file system;
- minimalism - this project is primarily about BEM, all the other build steps(minification, image optimization, etc.) depend on the preferences of the user.

## <a name="install">Install</a>
```
$ git clone https://github.com/alexander-sk/rapid-bem
$ npm i
$ npm run gulp
```