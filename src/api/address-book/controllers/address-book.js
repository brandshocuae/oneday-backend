'use strict';

/**
 * address-book controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::address-book.address-book');
