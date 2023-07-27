// src/extensions/users-permissions/content-types/user/lifecycles.js
module.exports = {
  beforeCreate(event) {
  },
  async afterCreate(event) {
    // const ctx = strapi?.requestContext.get();
    // // const { role } = ctx?.request?.body;
    // if(!role) {
    //   console.log("no role found");
    //   ctx.throw(400, "role is required");
    // }
    // try {
    //   const permission = await strapi.db
    //     .query("plugin::users-permissions.role")
    //     .findOne({ where: { ...ctx?.request?.body?.role } });


    //   const userRole = await strapi.db
    //     .query("plugin::users-permissions.user")
    //     .update({
    //       where: { id: event?.result?.id },
    //       data: {
    //         role: permission,
    //       },
    //     });

    //   const data = await strapi.db.query("api::customer.customer").create({
    //     data: {
    //       // Add your customer fields here, e.g.
    //       firstName: "",
    //       lastName: "",
    //       email: event?.result?.email,
    //       // Add the relation to the user
    //       user: {
    //         connect: {
    //           id: event?.result?.id, // Replace 'user_id' with the actual user ID you want to relate to the customer
    //         },
    //       },
    //     },
    //   }); 

    // } catch (error) {
    //   console.log("error in creating customers: ", error);
    // }
  },
  afterUpdate(event) {
  },
};
