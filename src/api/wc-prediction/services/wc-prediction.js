'use strict';

/**
 * wc-prediction service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::wc-prediction.wc-prediction');
