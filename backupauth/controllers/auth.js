const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::auth.auth", ({ strapi }) => {
  // Get the core auth controller
  const coreAuthController = strapi.controller("api::auth.auth");

  return {
    async register(ctx) {
      // Add your custom logic here, before the actual registration process
      console.log('inside custom register: ', ctx);
      // Fetch the desired role, e.g., 'custom_role'
      const customRole = await strapi
        .query("api::users-permissions.role")
        .findOne({ name: "customer" });

      // Check if the custom role exists
      if (!customRole) {
        ctx.throw(400, "Custom role not found");
        return;
      }

      // Set the custom role in the request body
      ctx.request.body.role = customRole.id;
console.log(ctx)
      // Call the core register action
      const response = await coreAuthController.register(ctx);

      // Add your custom logic here, after the actual registration process

      // Return the response
      return response;
    },
  };
});
