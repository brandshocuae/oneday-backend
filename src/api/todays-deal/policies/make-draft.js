"use strict";

/**
 * `make-draft` policy
 */

module.exports = (policyContext, config, { strapi }) => {
  // Add your own logic here.
  strapi.log.info("In make-draft policy.");

  const authorized = policyContext.state.user.role?.type === "admin";

  if (authorized) {
    const ctx = strapi.requestContext.get();

    // if publishedAt is not set to null it'll immediately get published
    if (ctx.request.body?.data?.publishedAt !== null) {
      ctx.request.body.data.publishedAt = null;
    }
    console.log("request context : ", ctx.request.body?.data?.publishedAt);
    return true;
  }

  return false;
};
