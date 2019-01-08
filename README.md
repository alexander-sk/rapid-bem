# Rapid BEM

<p align="center">
  <span>Русский</span> |
  <a href="https://github.com/alexander-sk/rapid-bem/blob/master/README.eng.md">English</a>
</p>

Сборщик фронтенда по методологии БЭМ с поддержкой уровней переопределения, шаблонизатора pug и автоматическим построением зависимостей на основе разметки.

## Содержание

- [Преимущества](#benefits)
- [Установка](#install)
- [Основные понятия](#concepts)
- [Использование](#usage)
- [BEM helper](#bem-helper)
- [Конфигурация](#config)
- [Почему не webpack?](#webpack)
- [Почему не project-stub или ENB?](#yandex)
- [Почему просто не склеить все с помощью gulp?](#gulp)
- [Примечания](#notes)

## <a name="benefits">Преимущества</a>
- поддержка шаблонизатора pug;
- автоматическое извлечение зависимостей из классов и pug миксинов;
- уровни переопределения;
- разбивка бандла на части(a.k.a. split chunks);
- пересборка модифицированных частей в режиме "gulp-watch";
- [BEM helper](#bem-helper) для удобного создания сущностей на файловой системе;
- минимализм – этот проект в первую очередь про БЭМ, все остальные этапы сборки(минификация, оптимизация изображений и т.д.) зависят от предпочтений пользователя.

## <a name="install">Установка</a>
```
$ git clone https://github.com/alexander-sk/rapid-bem
$ npm i
$ npm run gulp
```
## <a name="concepts">Основные понятия</a>
- __БЭМ сущность(или просто сущность)__ - блок, элемент или модификатор, выражается строкой в формате принятого [соглашения по именованию](https://ru.bem.info/methodology/naming-convention/);
- __реализация сущности(или реализация сущности в "x")__  - конечный результат сборки БЭМ сущности, с учетом всех уровней переопределения, целиком или для указанной технологии(pug, js, css);
- __шаблон__ –  точка сборки, каждому шаблону на выходе соответствует одноименный ".html" в финальной сборке, шаблоны располагаются в папке "src/templates";
- __шаблон сущности__ - реализация сущности в pug технологии;
- __pug миксин__ - миксин определяемый в шаблоне сущности и доступный для использования в шаблонах и других сущностях, имя миксина также должно соответствовать имени сущности;
- __локальный pug миксин__ - миксин доступный для использования и изменения только на уровнях переопределения данной БЭМ сущности;
- __БЭМ миксин__ - миксин в [терминах БЭМ](https://ru.bem.info/methodology/key-concepts/#%D0%9C%D0%B8%D0%BA%D1%81).

## <a name="usage">Использование</a>

#### Демо
***
- [Static Demo](https://github.com/alexander-sk/rapid-bem-static-demo)

#### Струтура проекта
***
**src/templates:**

Содержит шаблоны. Каждому шаблону в конечной сборке соответствует одноименный ".html". Шаблон не имеет отношение к реализации сущности, а служит точкой сборки БЭМ сущностей и местом определения разметки на самом верхнем уровне.

**src/templates/static:**

Содержит статический контент который будет скопирован в корень собранного проекта(например favicon). Контент находящийся здесь должен иметь отношение только к шаблонам.

**src/blocks:** 

Содержит реализации и переопределения сущностей.

**src/blocks/\*\*/img** и **src/blocks/\*\*/fonts**:

Изображения и шрифты имеющие отношение к конкретной сущности.

**config.js:**

Основная конфигурация сборщика.

**gulpfile.js:**

Конфигурация gulp. Может быть модифицирован для добавления пост обработки css, js, html.

#### Разметка
***
Для описания разметки используется привычный pug синтаксис, за исключением "include" и "extends". Допускается использование "include" только в формате "include имя-сущности". Использование "extends" не допускается.

__1. Использование сущностей__

Существует 3 способа подключить БЭМ сущность:

1. __Pug миксин__

    _src/blocks/button/button.pug:_
    ```
    mixin button
      button example
    ```
    _src/templates/index.pug:_
    ```
    h1 Index page
      +button
    ```
    _Результат сборки:_
    ```html
    <h1>Index page</h1>
    <button>example</button>
    ```

2. __Присвоить класс__

    _src/blocks/fonts/_text-red/fonts_text-red.css:_
    ```css
    .fonts_text-red {
      color: red;
    }
    ```

    _src/templates/index.pug:_
    ```
    h1 Index page
    p.fonts_text-red Red
    ```

    _Результат сборки:_

    Сущность  fonts_text-red автоматически будет включена в сборку.

    _index.html:_
    ```html
    <h1>Index page</h1>
    <p class="fonts_text-red">Red</p>
    ```

    _index.css:_
    ```css
    .fonts_text-red {
      color: red;
    }
    ```

3. __Явно подключить сущность используя include__

    _src/blocks/alert/alert.js:_
    ```js
    console.log('alert');
    ```
    _src/templates/index.pug:_
    ```
    include alert

    h1 Index page
    ```
    _Результат:_

    Сущность alert автоматически будет включена в сборку.

    _index.html:_
    ```html
    <h1>Index page</h1>
    ```
    _index.js:_
    ```js
    console.log('alert');
  	```

__2. Использование одних сущностей в разметке других БЭМ сущностей__ 

Ситуация когда необходимо использовать одну сущность из другой - вполне типичная. Это нужно для подключения к блоку его элементов, или когда есть сложный составной блок, что включает в себя простые блоки(напрмер базовые компоненты из библиотеки).

_src/blocks/button/button.pug:_
```
mixin button
  button example
```
_src/blocks/mega-block/mega-block.pug:_
```
mixin mega-block
  h2 Mega block
  +button
```
_src/templates/index.pug:_
```
h1 Index page
+mega-block
```
_Результат сборки:_
```html
<h1>Index page</h1>
<h2>Mega block</h2>
<button>example</button>
```

__3. Переопределения сущностей в pug реализации__

Может возникнуть ситуация когда необходимо разбить разметку блока, для того чтобы можно было переопределить какие-то части. Не всегда для этого подходит именно БЭМ элемент. Тут могут пригодиться локальные pug миксины. Такой миксин доступен только в пределах уровней переопределения данной сущности. Локальный миксин может иметь произвольное имя, но должен начинаться с подчеркивания.

_common.blocks/button/button.pug(уровень компонентов):_
```
mixin _private1
  p private1

mixin _private2
  p private 2

mixin button
  +private1
  +private2
```
_src/blocks/button/button.pug(переопределение на уровне проекта):_
```
mixin _private1
  p private1_redef
```
_src/templates/index.pug:_
```
h1 Index page
+button
```
_Результат сборки:_
```html
<h1>Index page</h1>
<p>private1_redef</p>
<p>private2</p>
```

Также при необходимости можно переопределить сущность полностью:

_common.blocks/button/button.pug(уровень компонентов):_
```
mixin _private1
  p private1

mixin _private2
  p private 2

mixin button
  +private1
  +private2
```
_src/blocks/button/button.pug(переопределение на уровне проекта):_
```
mixin button
  p button_redef
```
_src/templates/index.pug:_
```
h1 Index page
+button
```
_Результат сборки:_
```html
<h1>Index page</h1>
<p>button_redef</p>
```

__4. pug миксин + БЭМ миксин__

Зачастую возникает необходимость в пробросе класса внутрь pug миксина, для того чтобы создать [БЭМ микс](https://ru.bem.info/methodology/key-concepts/#%D0%9C%D0%B8%D0%BA%D1%81). Пример реализации:

_src/blocks/button/button.pug:_
```
mixin button
  button.button(class!=attributes.class) mix-example
```
_src/templates/index.pug:_
```
h1 Index page
+button.mix1.mix2
```
_Результат сборки:_
```html
<h1>Index page</h1>
<button class="button mix1 mix2">mix-example</button>
```

Также будут автоматически загружены реализации сущностей "mix1" и "mix2".

#### Переопределение CSS и JS
***
Конечная реализация сущности состоит из склейки найденных ".css" и ".js", в порядке следования уровней в конфигурационном файле, например:

_config.js:_
```js
...
levels: [
  'common.blocks',
  'src/blocks',
],
...
```
_common.blocks/block1/block1.css:_
```css
.block1 {
  color: red;
}
```
_src/blocks/block1/block1.css:_
```css
.block1 {
  color: green;
}
```
_Итоговая реализация сущности в css:_
```css
.block1 {
  color: red;
}

.block1 {
  color: green;
}
```

Позже неактуальные правила могут быть вырезаны на этапе минификации стилей.

#### Переопределение изображений и шрифтов
***
В сборку попадают все найденные на уровнях переопределения файлы в папках "img" и "fonts". Файл переопределяет файлы с таким же именем, пример:
```
common.blocks/block1/img:
  image1.svg
  image2.svg
```
```
src/blocks/block1/img:
  image2.svg
  image3.svg
```
Результат сборки:
```
build/img:
  image1.svg
  image2.svg - файл с уровня "src/blocks"
  image3.svg
```

#### <a name="bem-helper">BEM helper</a>
***
Это простой скрипт для создания сущностей на файловой системе, пример:
```
npm run add --e=block__elem_mod --t=js,css,pug
```
Используется [Nested](https://ru.bem.info/methodology/filestructure/#nested) схема организации файловой структуры. 
#### <a name="config">Конфигурация</a>
***
__config.js:__

_levels: []_

Уровни переопределения. Последний уровень в массиве переопределяет предыдущие.

_isProduction: false_

Режим сборки. В данный момент ни на что не влияет, настройка может быть использована при кастомизации сборщика.

_srcDir: 'src'_

Папка с исходным кодом, относительно этой папки будет происходить поиск "templates".

_jsSplit: true_

Разбивать JS?(не влияет на vendorBlocks)

_cssSplit: true_

Разбивать CSS?(не влияет на vendorBlocks)

_minChunks: 2_

Минимальное количество вхождений сущности, чтобы она попала в common.css/common.js.

_vendorBlocks: []_
  
Блоки в которые завернуты сторонние библиотеки, будут вынесены в vendor.css/vendor.js.
  
 __gulpfile.js:__

Для кастомизации сборки, например для добавления минификации стилей, необходимо модифицировать соответствующую функцию объекта pipe.

## <a name="webpack">Почему не webpack?</a>
Webpack ориентирован на работу с зависимостями в терминах JS. В ситуации когда нет необходимости описывать разметку и стили как webpack модули -  webpack становится менее эффективным. Кроме того, работая по БЭМ методологии, нет необходимости описывать зависимости вручную, поскольку граф зависимостей может быть построен на основе разметки. При необходимости можно доопределить некоторые зависимости, что не могут быть извлечены из разметки(например блоки только с JS реализацией или модификаторы которые присваиваются динамически и которых нет в разметке на момент сборки).

## <a name="yandex">Почему не [project-stub](https://github.com/bem/project-stub) или [ENB](https://ru.bem.info/toolbox/enb/)?</a>
Эти сборщики ориентированы на работу с БЭМ стеком от Яндекс. Данный проект использует основные концепции методологии, но не использует технологии сборки предлагаемые Яндексом, за исключением нескольких модулей из [bem-sdk](https://github.com/bem/bem-sdk) для работы с именами сущностей и представлением на файловой системе. Фактически pug в данном сборщике заменяет шаблонизатор и технологию описания зависимостей предлагаемые Яндексом.
## <a name="gulp">Почему просто не склеить все с помощью gulp?</a>
Такой подход справедлив только для небольшого проекта, без уровней переопределения. Задачи которые решает данный сборщик в сравнении с обычной склейкой:

1. Конечная сборка включает только те сущности которые реально присутствуют на проекте. Иными словами, мы можем иметь большую библиотеку компонентов и много уровней переопределения, но в сборку будет включено только необходимое.
2. Возможность переопределения и доопределения в pug реализации сущности и локальные pug миксины.
3. Отсутствие необходимости вручную прописывать пути в pug, достаточно написать: "include имя-сущности", "+имя-сущности" или присвоить класс соответствующий сущности и реализация будет автоматически загружена.
4. Продвинутый бандлинг.

## <a name="notes">Примечания</a>

В данный момент сборщик находиться в активной разработке и не рекомендуется его использование в качестве замены привычного workflow.

Известные проблемы:

1. Попадание в сборку неиспользуемых сущностей, когда переопределяющий pug миксин исключает сущности на более высоких уровнях переопределения. В данный момент, реализация сущности в pug просто сканируется на наличие "include entity", ".entity", "+entity" - все найденные сущности включаются в сборку, без учета финальной отрисовки разметки.
2. Падение сборщика в режиме gulp-watch при некоторых ошибках в разметке.

Планы:

1. Интеграция [модульной системы](https://github.com/ymaps/modules) и [i-bem](https://ru.bem.info/technologies/classic/i-bem/).
2. Произвольный [raw-include](https://pugjs.org/language/includes.html#including-plain-text) в pug и [кастомные фильтры](https://pugjs.org/language/filters.html#custom-filters).
