"use strict";

/**
 * customer-query controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::customer-query.customer-query",
  ({ strapi }) => ({
    async create(ctx) {
      const requestData = ctx.request.body;
      console.log(requestData);

      try {
        const customer = await strapi.entityService.findOne(
          "api::customer.customer",
          requestData.customer,
          {
            populate: ["user"],
          }
        );

        console.log(customer);

        let emailData = "";

        await strapi.entityService.create(
          "api::customer-query.customer-query",
          {
            data: { ...requestData, publishedAt: new Date() },
          }
        );

        for (const singleData in requestData.data) {
          emailData =
            emailData +
            `<br> <b>${singleData}:</b> ${requestData.data[singleData]}`;
        }

        await strapi
          .plugin("email")
          .service("email")
          .send({
            to: "projectmanageratgeek@gmail.com",
            from: customer.user.email,
            replyTo: customer.user.email,
            subject: `${requestData.type} Received`,
            html: "<p>" + emailData + "</p>",
          });
      } catch (error) {
        return ctx.badRequest("Error Sending Email", JSON.stringify(error));
      }
      return { data: "Email Sent Successfully" };
    },
    async update(ctx) {
      const queryId = ctx.params.id;
      console.log(queryId);

      if (
        ctx.request.body.admin_reponse &&
        typeof ctx.request.body.admin_reponse == "string"
      ) {
        try {
          const foundquery = await strapi.entityService.findOne(
            "api::customer-query.customer-query",
            queryId,
            {
              populate: ["customer", "customer.user"],
            }
          );
          console.log(foundquery);

          if (foundquery.responded)
            return { data: "Already responded to this query" };

          let emailData = ctx.request.body.admin_reponse;

          await strapi
            .plugin("email")
            .service("email")
            .send({
              to: foundquery.customer.user.email,
              // to: "projectmanageratgeek@gmail.com",
              from: "info@oneday.ae",
              replyTo: "info@oneday.ae",
              subject: `Respond to ${foundquery.type} #${queryId}`,
              html: "<p>" + emailData + "</p>",
            });

          const published = await strapi.entityService.update(
            "api::customer-query.customer-query",
            queryId,
            {
              data: {
                admin_reponse: ctx.request.body.admin_reponse,
                responded: true,
              },
            }
          );
        } catch (error) {
          return ctx.badRequest("Error Sending Email", JSON.stringify(error));
        }
        return { data: "Reqplied Successfully" };
      } else {
        return ctx.badRequest("Validation Error", "Missing admin response");
      }
    },
  })
);
