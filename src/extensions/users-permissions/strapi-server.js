("use strict");

const _ = require("lodash");
const jwt = require("jsonwebtoken");
const utils = require("@strapi/utils");
const user = require("./content-types/user");
const auth = require("@strapi/admin/server/services/auth");

const getController = (name) => {
  return strapi.plugins["users-permissions"]?.controller(name);
};

const { sanitize } = utils;
const { ApplicationError, ValidationError } = utils.errors;

const emailRegExp =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const sanitizeUser = (user, ctx) => {
  const { auth } = ctx.state;
  const userSchema = strapi.getModel("plugin::users-permissions.user");

  return sanitize.contentAPI.output(user, userSchema, { auth });
};

// validation
const { yup, validateYupSchema } = require("@strapi/utils");
const registerBodySchema = yup.object().shape({
  email: yup.string().email().required(),
  password: yup.string().required(),
  username: yup
    .string()
    .matches(
      /^[A-Za-z0-9_.]*$/,
      "whitespace are not allowed. make sure username contains only '_' & '.'  & "
    )
    .required(),
  role: yup.string().required(),
});

const validateRegisterBody = validateYupSchema(registerBodySchema);

module.exports = (plugin) => {
  // JWT issuer
  const issue = (payload, jwtOptions = {}) => {
    _.defaults(jwtOptions, strapi.config.get("plugin.users-permissions.jwt"));
    return jwt.sign(
      _.clone(payload.toJSON ? payload.toJSON() : payload),
      strapi.config.get("plugin.users-permissions.jwtSecret"),
      jwtOptions
    );
  };

  //   Register controller override
  plugin.controllers.auth.register = async (ctx) => {
    const pluginStore = await strapi.store({
      type: "plugin",
      name: "users-permissions",
    });

    const settings = await pluginStore.get({
      key: "advanced",
    });

    if (!settings.allow_register) {
      throw new ApplicationError("Register action is currently disabled");
    }

    const params = {
      ..._.omit(ctx.request.body, [
        "confirmed",
        "confirmationToken",
        "resetPasswordToken",
      ]),
      provider: "local",
    };

    await validateRegisterBody(params);

    // Throw an error if the password selected by the user
    // contains more than three times the symbol '$'.
    // if (
    //   strapi.service("plugin::users-permissions.user").isHashed(params.password)
    // ) {
    //   throw new ValidationError(
    //     "Your password cannot contain more than three times the symbol `$`"
    //   );
    // }

    const role = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: params?.role || settings.default_role } });

    if (!role) {
      throw new ApplicationError("Impossible to find the default role");
    }

    // Check if the provided email is valid or not.
    const isEmail = emailRegExp.test(params.email);

    if (isEmail) {
      params.email = params.email.toLowerCase();
    } else {
      throw new ValidationError("Please provide a valid email address");
    }

    params.role = role.id;

    params.password = await auth.hashPassword(params.password);

    const user = await strapi.query("plugin::users-permissions.user").findOne({
      where: { email: params.email },
    });


    if(user && user.username.toLowerCase() === params?.username.toLowerCase()) {
      throw new ValidationError("username is already taken: Allowed username may contain alphanumerics _ and . ]");
    }
    if (user && user.provider === params.provider) {
      throw new ValidationError("Email is already taken");
    }

    if (user && user.provider !== params.provider && settings.unique_email) {
      throw new ValidationError("Email is already taken here");
    }

    try {
      if (!settings.email_confirmation) {
        params.confirmed = true;
      }

      const user = await strapi
        .query("plugin::users-permissions.user")
        .create({ data: params, populate: { role: true } });

      switch (user?.role?.type) {
        case "customer":
          console.log("creating customer");
          const customer = await strapi.db
            .query("api::customer.customer")
            .create({
              data: {
                firstName: params?.firstName || "",
                lastName: params?.lastName || "",
                email: params?.email,
                publishedAt: new Date(),
                // Add the relation to the user
                user: {
                  connect: {
                    id: user?.id,
                  },
                },
              },
            });
          break;
        case "seller":
          console.log("creating seller");

          const seller = await strapi.db.query("api::seller.seller").create({
            data: {
              // Add your customer fields here, e.g.
              products: null,
              userId: {
                connect: {
                  id: user?.id, // Replace 'user_id' with the actual user ID you want to relate to the customer
                },
              },
            },
          });
        case "admin":
          console.log("creating admin");

          // const admin = await strapi.db.query("api::seller.seller").create({
          //   data: {
          //     // Add your customer fields here, e.g.
          //     products: null,
          //     userId: {
          //       connect: {
          //         id: user?.id, // Replace 'user_id' with the actual user ID you want to relate to the customer
          //       },
          //     },
          //   },
          // });
          break;

        default:
          break;
      }

      const sanitizedUser = await sanitizeUser({ user }, ctx);

      if (settings.email_confirmation) {
        try {
          await strapi
            .service("plugin::users-permissions.user")
            .sendConfirmationEmail(sanitizedUser);
        } catch (err) {
          throw new ApplicationError(err.message);
        }

        return ctx.send({ user: sanitizedUser });
      }

      const jwt = issue(_.pick(user, ["id"]));

      return ctx.send({
        jwt,
        user: sanitizedUser?.user,
      });
    } catch (err) {
      console.log("error occured :", err);
      if (_.includes(err.name, "ValidationError")) {
        throw new ValidationError(
          "validation error",
          err?.details?.errors || err
        );
      } else if (_.includes(err.message, "username")) {
        throw new ApplicationError("Username already taken");
      } else if (_.includes(err.message, "email")) {
        throw new ApplicationError("Email already taken");
      } else {
        throw new ApplicationError("⛔ something went wrong!");
      }
    }
  };

  plugin.routes["content-api"].routes.unshift({
    method: "POST",
    path: "/auth/local/register",
    handler: "auth.register",
    config: {
      middlewares: ["plugin::users-permissions.rateLimit"],
      prefix: "",
    },
  });

  return plugin;
};
