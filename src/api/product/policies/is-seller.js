"use strict";

/**
 * `verifyAdmin` policy
 */

const utils = require("@strapi/utils");
const { PolicyError } = utils.errors;

module.exports = (policyContext, config, { strapi }) => {
  strapi.log.info("In verifyAdmin policy.");
  console.log("policy context",  policyContext.state);
  console.log(policyContext.state.user.role);
  const authorized = policyContext.state.user.role?.type === "seller";

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
