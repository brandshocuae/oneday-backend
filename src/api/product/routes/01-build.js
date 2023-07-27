module.exports = {
  routes: [
    {
      method: "GET",
      path: "/products/:id/build",
      handler: "build.build",
      config: {
        policies: ["api::product.is-seller"],
      },
    },
  ],
};
