module.exports = {
  async getproducts(ctx, next) {
    try {
      const product = await strapi.entityService.findMany(
        "api::product.product",

        {
          populate: { price: true },
          fields: ["*"],
          filters: { users_permissions_user: ctx.params?.sellerId },
        }
      );
      ctx.send(product);
    } catch (err) {
      ctx.badRequest("Post report controller error", { moreDetails: err });
    }
  },

  async getNumberOfProduct(ctx, next) {
    try {
      const { results, pagination } = await strapi
        .service("api::product.product")
        .find();

      ctx.send({ totalProducts: pagination.total });
    } catch (err) {
      ctx.badRequest("Post report controller error", { moreDetails: err });
    }
  },
  async getproductsbyadmin(ctx, next) {
    try {
      //   console.log("ctx.query ==>>>", ctx.query);

      const { results: product, pagination } = await strapi
        .service("api::product.product")
        .find(ctx.query);

      // const product = await strapi.entityService.findMany(
      //   "api::product.product",
      //   {
      //     ...ctx.query,
      //   }
      // );
      const todaydeals = await strapi.entityService.findMany(
        "api::todays-deal.todays-deal",
        {
          populate: ["dealProducts", "dealProducts.products"],
          // populate:{"dealProducts.products":true},
          fields: ["*"],
        }
      );
      todaydeals.map((item) => {
        item.dealProducts.forEach((deal) => {
          deal.products.forEach((dealProduct) => {
            const matchingProduct = product.findIndex(
              (product) => product.id === dealProduct.id
            );
            if (matchingProduct != -1) {
              let lastUsedDays = [];
              lastUsedDays.push(item.createdAt);
              const date1 = new Date(item.createdAt); // First date
              const date2 = new Date(); // Second date

              // Calculate the time difference in milliseconds
              const timeDiff = Math.abs(date2 - date1);

              // Convert milliseconds to days
              const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

              product[matchingProduct].noOfDays = daysDiff;
              product[matchingProduct].lastUsedDays = lastUsedDays;
            }
          });
        });
        // for (var i = 0; i < product.length; i++) {
        //     if (item.dealProducts.products.includes((val) => { return val.id == product[i].id })) {
        //         console.log(product[i])

        //     }
        // }
      });
      ctx.send({ data: product, meta: pagination });
    } catch (err) {
      ctx.badRequest("Post report controller error", { moreDetails: err });
    }
  },
};
