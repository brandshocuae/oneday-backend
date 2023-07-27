'use strict';

/**
 * todays-deal service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::todays-deal.todays-deal');
