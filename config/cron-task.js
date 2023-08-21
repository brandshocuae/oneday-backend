module.exports = {
  /**
   * Simple example.
   * Every monday at 1am.
   */

  myJob: {
    task: async ({ strapi }) => {
      // Add your own logic here (e.g. send a queue of email, create a database backup, etc.).
      // const sellers = await strapi.entityService.findMany(
      //   "api::seller.seller",
      //   {
      //     fields: ["id"],
      //     publicationState: "live",
      //   }
      // );
      // sellers.forEach(async (seller) => {
      //   let todaysDate = new Date();
      //   todaysDate.setHours(0, 0, 0, 0);
      //   function padTo2Digits(num) {
      //     return num.toString().padStart(2, "0");
      //   }
      //   function formatDate(date) {
      //     return [
      //       date.getFullYear(),
      //       padTo2Digits(date.getMonth() + 1),
      //       padTo2Digits(date.getDate() - 1),
      //     ].join("-");
      //   }
      //   todaysDate = formatDate(new Date());
      //   const sellerOrders = await strapi.entityService.findMany(
      //     "api::seller-orders.seller-orders",
      //     {
      //       populate: [
      //         "order_items",
      //         "order_items.product",
      //         "order_items.product.price",
      //         "order_items.product.productImages",
      //       ],
      //       filters: { order_id: `orders-${todaysDate}-seller${seller.id}` },
      //     }
      //   );
      //   let completeEmail;
      //   let emailBody;
      //   if (sellerOrders.length == 1) {
      //     emailBody = sellerOrders[0].order_items.map((ord_row, i) => {
      //       const imageCheck = () => {
      //         const imgSrc = ord_row.product?.productImages[0]?.url;
      //         if (imgSrc) {
      //           return imgSrc;
      //         } else {
      //           return ord_row?.product?.productImages[0].formats?.medium?.url;
      //         }
      //       };
      //       return `<tr>
      //           <td>${ord_row.id}</td>
      //           <td>
      //             ${
      //               ord_row?.product?.productName?.length > 30
      //                 ? ord_row?.product?.productName.slice(0, 29) + "...."
      //                 : ord_row?.product?.productName
      //             }
      //           </td>
      //           <td>
      //             <img height="50" src="${imageCheck()}" />
      //           </td>
      //           <td>
      //             ${ord_row?.product?.price?.discountPrice}
      //           </td>
      //           <td>${ord_row?.quantity}</td>
      //         </tr>
      //       `;
      //     });
      //     completeEmail = `<table border="1"><thead> <tr> <th > ID </th> <th > product name </th> <th > Image </th> <th > Price </th> <th > quantity </th> </tr></thead><tbody>${emailBody}</tbody>
      //     </table>`;
      //     await strapi.plugin("email").service("email").send({
      //       to: "projectmanageratgeek@gmail.com",
      //       from: "social@oneday.ae",
      //       subject: "Order Confirmed",
      //       html: completeEmail,
      //     });
      //   }
      // });
      // console.log(seller.id, completeEmail);
    },
    options: {
      rule: "0 0 0 * * *",
    },
  },
};
