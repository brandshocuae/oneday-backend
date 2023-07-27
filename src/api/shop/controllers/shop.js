"use strict";

/**
 * shop controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const { ApplicationError } = require("@strapi/utils/lib/errors");
const { parseMultipartData, sanitize } = require("@strapi/utils");

module.exports = createCoreController("api::shop.shop", ({ strapi }) => ({
  async create(ctx) {
    try {
      if (ctx.is("multipart")) {
        const multipart = await parseMultipartData(ctx);
        if (!multipart.files) {
          throw new Error("Empty File: shop image is required");
        }
      }
      const shop = await super.create(ctx);

      if (!shop) throw new Error("could not create shop");

      return { data: shop.data, meta: shop.meta };
    } catch (error) {
      console.log("error occurred while creating shop: ", error);
      if (error.name === "Error" && !error?.details) {
        throw new ApplicationError(
          "error while creating shop :",
          error.message
        );
      }
      throw new ApplicationError(
        "error while creating shop",
        error?.details?.errors.map(({ message, name }) => ({
          message,
          name,
        }))
      );
    }
  },
  // async update(ctx) {
  //   try {

  //     if (ctx.is("multipart")) {

  //       const { data, files } = parseMultipartData(ctx);

  //       console.log(files);
  //       if (!files.shopBanner ) {
  //         throw new Error("Empty File: product image is required");
  //       }
  //       console.log(data,files)
  //     }
  //     console.log(ctx)
  //     const updateddata = await strapi.entityService.update(
  //       "api::shop.shop",
  //       ctx.request.params.id,
  //       {
  //         data:
  //         ctx,

  //       }
  //     );

  //     console.log(updateddata)

  //     // Return the updated product as the response
  //     // ctx.send(updatedProduct);
  //     return { data: updateddata };

  //     // const shop = await super.create(ctx);

  //     // if (!shop) throw new Error("could not create shop");

  //     // return { data: shop.data, meta: shop.meta };
  //   } catch (err) {
  //     console.log("/////", err)

  //   }
  // }
}));
