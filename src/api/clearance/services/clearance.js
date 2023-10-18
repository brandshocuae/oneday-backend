'use strict';

/**
 * clearance service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::clearance.clearance');
