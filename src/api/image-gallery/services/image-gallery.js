'use strict';

/**
 * image-gallery service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::image-gallery.image-gallery');
