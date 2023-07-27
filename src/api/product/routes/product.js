"use strict";

/**
 * product router
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter("api::product.product", {
  config: {
    create: {
      policies: ["api::product.is-seller"],
    },
    updateProduct: {},
    publishProduct: {
      publish: {
        policies: ["api::product.is-admin"],
      },
    },
  },
});
