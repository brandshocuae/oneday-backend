"use strict";

/**
 * `is-customer` policy
 */

module.exports = (policyContext, config, { strapi }) => {
  strapi.log.info("In verifyAdmin policy.");

  const authorized = policyContext.state.user.role?.type === "customer";

  if (authorized) {
    return true;
  }

  strapi.log.error(
    `policy error: ${policyContext.request.method} : ${policyContext.request.path} user Id :  ${policyContext.state.user.role?.id}`
  );

  throw new PolicyError("user not authorized to access this endpoint", {
    policy: "is-seller",
  });
};
