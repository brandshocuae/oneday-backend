"use strict";

/**
 * `make-draft` policy
 */

module.exports = (policyContext, config, { strapi }) => {
  // Add your own logic here.
  strapi.log.info("In make-draft policy.");

  const authorized = policyContext.state.user.role?.type === "admin";

  if (authorized) {
    return true;
  }

  return false;
};
