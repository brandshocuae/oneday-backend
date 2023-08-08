"use strict";

/**
 * A set of functions called "actions" for `build`
 */

const _ = require("lodash");
const {
  ApplicationError,
  ValidationError,
} = require("@strapi/utils/lib/errors");

module.exports = {
  all: async (ctx) => {
    const deals = await strapi.entityService.findMany(
      "api::todays-deal.todays-deal",
      {
        ...ctx.query,
      }
    );
    //   const today = new Date();
    //   const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    //   const deals = await strapi.query('today-deal').find({
    //     date_gte: startOfDay,
    //   });

    return deals;
  },
};
