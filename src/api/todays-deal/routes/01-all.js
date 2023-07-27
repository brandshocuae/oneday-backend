// {
//     "method": "GET",
//     "path": "/today-deal",
//     "handler": "today-deal.findTodayDeal"
//   }
module.exports = {
    routes: [
      {
        method: "GET",
        path: "/todays-deals/all",
        handler: "all.all",
        config: {
          policies:  ['api::todays-deal.is-admin'],
        },
      },
    ],
  };
