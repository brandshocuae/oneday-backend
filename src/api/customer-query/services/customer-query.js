'use strict';

/**
 * customer-query service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::customer-query.customer-query');
