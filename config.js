'use strict';

module.exports = {
  levels: [
    'common.blocks',
    'src/blocks',
  ],
  isProduction: false,
  srcDir: 'src',
  splitChunks: {
    jsSplit: true,
    cssSplit: true,
    minChunks: 2,
    vendorBlocks: [],
  },
};