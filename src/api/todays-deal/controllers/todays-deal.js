"use strict";

/**
 * todays-deal controller
 */

/**
 *
  timezone for production
    Asia/Dubai
*/

const { createCoreController } = require("@strapi/strapi").factories;
const { utcToZonedTime, format } = require("date-fns-tz");
const { parseMultipartData } = require("@strapi/utils");

const formatTimeToISO = (date) => {
  // Get the current date
  let currentDate;
  if (!date) {
    currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
  } else {
    currentDate = date;
  }

  // Define the time zone
  const timeZone = process.env.TZ;

  // Convert the current date to the specified time zone
  const karachiDate = utcToZonedTime(currentDate, timeZone);

  // Format the date
  const formattedDate = format(
    karachiDate,
    // "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
    "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
    {
      timeZone,
    }
  );
  return formattedDate;
};

module.exports = createCoreController(
  "api::todays-deal.todays-deal",
  ({ strapi }) => ({
    async create(ctx) {
      const { data, files } = parseMultipartData(ctx);

      console.log("before =>", data);
      data.startDateTime = formatTimeToISO(
        new Date(data.startDateTime).setHours(0, 0, 0, 0)
      );
      data.endDateTime = formatTimeToISO(
        new Date(data.endDateTime).setHours(23, 59, 59, 0)
      );
      const results = await strapi
        .service("api::todays-deal.todays-deal")
        .create({ data: data, files });
      return results;
      // return this.transformResponse(results, { pagination });
    },
    async find(ctx) {
      const formattedDate = formatTimeToISO();

      ctx.query = {
        ...ctx.query,
        filters: {
          startDateTime: {
            $eq: formattedDate,
          },
        },
        populate: [
          "shops",
          "shops.deals",
          "shops.shopBanner",
          "shops.deals.price",
          "shops.deals.categories",
          "shops.deals.productImages",
          "dealMainBanner",
          "dealProducts",
          "dealProducts.products",
          "dealProducts.products.price",
          "dealProducts.products.categories",
          "dealProducts.products.productImages",
          // "shops.deals.markup",
          // "dealProducts.products.markup",
        ],
      };
      const { data, meta } = await super.find(ctx);

      // // for dealProducts
      // data[0]?.attributes?.dealProducts.map((singleDeal) => {
      //   singleDeal?.products?.data.map((singleProduct) => {
      //     if (singleProduct?.attributes?.markup?.data != null) {
      //       console.log("product has markup");
      //       let price = singleProduct?.attributes?.price?.price;
      //       let discountPrice = singleProduct?.attributes?.price?.discountPrice;
      //       singleProduct.attributes.price.price =
      //         price +
      //         (price *
      //           singleProduct?.attributes?.markup?.data?.attributes
      //             ?.value_percentage) /
      //           100;
      //       singleProduct.attributes.price.discountPrice =
      //         discountPrice +
      //         (discountPrice *
      //           singleProduct?.attributes?.markup?.data?.attributes
      //             ?.value_percentage) /
      //           100;
      //     }
      //   });
      // });

      // // for dealShops
      // data[0]?.attributes?.shops?.data.map((singleShop) => {
      //   singleShop?.attributes?.deals?.data.map((singleProduct) => {
      //     if (singleProduct?.attributes?.markup?.data != null) {
      //       console.log("shop has markup");
      //       let price = singleProduct?.attributes?.price?.price;
      //       let discountPrice = singleProduct?.attributes?.price?.discountPrice;
      //       singleProduct.attributes.price.price =
      //         price +
      //         (price *
      //           singleProduct?.attributes?.markup?.data?.attributes
      //             ?.value_percentage) /
      //           100;
      //       singleProduct.attributes.price.discountPrice =
      //         discountPrice +
      //         (discountPrice *
      //           singleProduct?.attributes?.markup?.data?.attributes
      //             ?.value_percentage) /
      //           100;
      //     }
      //   });
      // });

      // data = data.filter(d => d.startDateTime === formattedDate)
      return { data, meta, formattedDate };
    },
  })
);
