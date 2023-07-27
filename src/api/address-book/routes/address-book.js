'use strict';

/**
 * address-book router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::address-book.address-book');
