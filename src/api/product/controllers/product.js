"use strict";

/**
 * product controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const { parseMultipartData, sanitize } = require("@strapi/utils");
const { ApplicationError } = require("@strapi/utils/lib/errors");

module.exports = createCoreController("api::product.product", ({ strapi }) => ({
  async create(ctx) {
    try {
      if (ctx.is("multipart")) {
        const { data, files } = parseMultipartData(ctx);
        if (!files || !files.productImages) {
          throw new Error("Empty File: product image is required");
        }
      }
      const product = await super.create(ctx);

      if (!product) throw new Error("could not create product");

      return { data: product.data, meta: product.meta };
    } catch (error) {
      console.log("error occurred while creating product: ", error);
      if (error.name === "Error" && !error?.details) {
        throw new ApplicationError(
          "error while creating product :",
          error.message
        );
      }
      throw new ApplicationError(
        "error while creating product",
        error?.details?.errors.map(({ message, name }) => ({
          message,
          name,
        }))
      );
    }
  },

  updateProduct: async (ctx) => {
    const { id } = ctx.params;
    const { updatedData } = ctx.request.body;

    console.log("trying to update the product ===> ", updatedData);

    try {
      // Add your custom logic here
      // For example, update the product with the provided data
      const updatedProduct = await strapi.services.product.update(
        { id },
        updatedData
      );

      // Return the updated product as the response
      // ctx.send(updatedProduct);
      return { data: updatedProduct };
    } catch (error) {
      ctx.throw(500, "An error occurred while updating the product.");
    }
  },

  publishProduct: async (ctx) => {
    const { id } = ctx.params;
    const { updatedData } = ctx.request.body;

    try {
      // Add your custom logic here
      // For example, update the product with the provided data
      const updatedProduct = await strapi.services.product.update(
        { id },
        updatedData.publishDate
      );

      // Return the updated product as the response
      // ctx.send(updatedProduct);
      return { data: updatedProduct };
    } catch (error) {
      ctx.throw(500, "An error occurred while updating the product.");
    }
  },
}));
