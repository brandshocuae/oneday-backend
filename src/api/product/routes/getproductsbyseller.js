module.exports = {
  routes: [
    {
      method: "GET",
      path: "/getproductsbyseller/:sellerId",
      handler: "getproductsbyseller.getproducts",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/products/all",
      handler: "getproductsbyseller.getproductsbyadmin",
      config: {
        policies: ["api::product.is-admin"],
      },
    },
    {
      method: "GET",
      path: "/products/total",
      handler: "getproductsbyseller.getNumberOfProduct",
    },
  ],
};
