'use strict';

/**
 * markup service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::markup.markup');
