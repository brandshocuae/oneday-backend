'use strict';

/**
 * address-book service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::address-book.address-book');
