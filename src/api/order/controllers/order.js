"use strict";

/**
 * order controller
 */
const { createCoreController } = require("@strapi/strapi").factories;
const _ = require("lodash");
const stripe = require("stripe")(process.env.SECRET_TEST_KEY);
const fetch = require("node-fetch");
const schedule = require("node-schedule");
const easyinvoice = require("easyinvoice");
const fs = require("fs");

// validation
const { yup, validateYupSchema, errors } = require("@strapi/utils");

const { ApplicationError, ValidationError, NotFoundError } = errors;

const LINK_EXPIRE = 30;
const IMILE_BASE_URL = "https://openapi.52imile.cn";
// const IMILE_BASE_URL = "https://openapi.imile.com";

const orderSchema = yup.object().shape({
  data: yup
    .object()
    .shape({
      order_items: yup
        .array(
          yup
            .object()
            .shape({
              product: yup
                .number()
                .required("product id is required!")
                .typeError("a numeric value is required"),
              variation: yup
                .number()
                .required("variant id is required!")
                .typeError("a numeric value is required"),
              quantity: yup
                .number()
                .required("quantity is required!")
                .typeError("a numeric value is required"),
              subTotal: yup
                .number()
                .required("Sub Total is required!")
                .typeError("a numeric value is required"),
            })
            .required("order items are not in proper shape")
        )
        .min(1, "at least 1 order item is required")
        .required("no order_items provided!"),
      payment_method: yup.number().required("Payment Method is required!"),
    })
    .required(),
});

const validateSchema = validateYupSchema(orderSchema);

const fromDecToInt = (number) => parseInt(number * 100);

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    const invoiceData = {
      client: {
        country: "UAE",
        company: "ONEDAY AE",
      },
      sender: {
        company: "",
        address: "",
        zip: "",
        city: "dubai",
        country: "UAE",
        phone: "04591 9932",
      },
      images: {
        logo: "https://oneday.ae/Logo.png",
      },

      information: {
        date: "",
      },
      products: [],
      bottomNotice:
        "If you have selected Online Payment Method thne pay within 30 Minutes else your order will be cancelled",
      settings: {
        currency: "AED",
      },
    };

    const DEFAULT_PARAMS = {
      customerId: process.env.IMILE_CUSTOMER_ID,
      sign: process.env.IMILE_API_KEY,
      accessToken: "",
      signMethod: "SimpleKey",
      format: "json",
      version: "1.0.0",
      timestamp: new Date().getTime(),
      timeZone: "+4",
    };

    const deliveryParams = {
      ...DEFAULT_PARAMS,
      param: {
        orderCode: "",
        orderType: "100",
        oldExpressNo: "",
        consignorContact: "Brands Hoc Group LLC",
        consignorPhone: "04591 9932",
        consignorMobile: "",
        consignorCountry: "UAE",
        consignorProvince: "",
        consignorCity: "Dubai",
        consignorArea: "",
        consignorAddress:
          "Office 1602, Al Owais Business Tower AL Sabkha Street, Deira",
        consignorLongitude: "",
        consignorLatitude: "",
        consignee: "",
        consigneeContact: "",
        consigneeMobile: "",
        consigneePhone: "",
        consigneeEmail: "",
        consigneeCountry: "UAE",
        consigneeProvince: "",
        consigneeCity: "",
        consigneeArea: "",
        consigneeAddress: "",
        consigneeLongitude: "",
        consigneeLatitude: "",
        goodsValue: ctx.request.body?.data?.totalAmount,
        collectingMoney: ctx.request.body?.data?.totalAmount,
        paymentMethod: "200",
        totalCount: "1",
        totalWeight: "",
        totalVolume: "",
        skuTotal: 0,
        skuName: "",
        skuZh: "",
        deliveryRequirements: "",
        orderDescription: "",
        buyerId: "",
        platform: "",
        isInsurance: 0,
        pickDate: "",
        pickType: "0",
        batterType: "",
        currency: "Local",
        skuDetailList: [],
      },
    };

    await fetch(`${IMILE_BASE_URL}/auth/accessToken/grant`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...DEFAULT_PARAMS,
        param: {
          grantType: "clientCredential",
        },
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        // console.log(data, DEFAULT_PARAMS);
        DEFAULT_PARAMS.accessToken = data.data.accessToken;
        deliveryParams.accessToken = data.data.accessToken;
      })
      .catch((err) => console.error(err));

    try {
      const { body } = ctx.request;

      // delivery params ready

      // validate only authenticated users
      if (!ctx.state.isAuthenticated) {
        ctx.badRequest("you must login first");

        // throw new ApplicationError("you must login first");
      }

      if (ctx.state?.user?.role?.name !== "customer") {
        ctx.badRequest("you must login as customer to create orders");

        // throw new ApplicationError(
        //   "you must login as customer to create orders"
        // );
      }

      const { user } = ctx.state;

      await validateSchema(body);

      // get customer id for user
      const [customer] = await strapi.entityService.findMany(
        "api::customer.customer",
        {
          fields: ["*"],
          populate: ["user"],
          filters: { user: user?.id },
        }
      );
      let checkoutUrl = null;
      let totalWeight = 0;

      // console.log(customer);

      deliveryParams.param.consignee =
        customer.firstName + " " + customer.lastName;
      deliveryParams.param.consigneeContact =
        customer.firstName + " " + customer.lastName;
      deliveryParams.param.consigneeMobile = "";
      deliveryParams.param.consigneePhone = body?.data?.deliveryAddress.contact;
      deliveryParams.param.consigneeEmail = customer.user.email;
      deliveryParams.param.consigneeCity = body?.data?.deliveryAddress.city;
      deliveryParams.param.consigneeAddress =
        body?.data?.deliveryAddress.addressLine1;
      deliveryParams.param.consigneeLongitude =
        body?.data?.deliveryAddress.long;
      deliveryParams.param.consigneeLatitude = body?.data?.deliveryAddress.lat;

      invoiceData.client.address = body?.data?.deliveryAddress.addressLine1;
      invoiceData.client.city = body?.data?.deliveryAddress.city;
      invoiceData.client.company = customer.firstName + " " + customer.lastName;

      let todaysDate = new Date();

      // ✅ Reset a Date's time to midnight
      todaysDate.setHours(0, 0, 0, 0);

      // ----------------------------------------------------

      // ✅ Format a date to YYYY-MM-DD (or any other format)
      function padTo2Digits(num) {
        return num.toString().padStart(2, "0");
      }

      function formatDate(date) {
        return [
          date.getFullYear(),
          padTo2Digits(date.getMonth() + 1),
          padTo2Digits(date.getDate()),
        ].join("-");
      }
      todaysDate = formatDate(new Date());

      // create order with customer id
      const order = await strapi.entityService.create("api::order.order", {
        data: {
          customer: customer.id,
          deliveryAddress: body?.data?.deliveryAddress,
          totalAmount: body?.data?.totalAmount,
          fulfilled: false,
          delivered: false,
          payment_method: body?.data?.payment_method,
        },
      });
      deliveryParams.param.skuTotal = body?.data?.order_items.length;

      if (body?.data?.payment_method == 2) {
        const BASE_URL = ctx.request.headers.origin || "https://oneday.ae";

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          customer_email: customer.user.email,
          mode: "payment",
          success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&orderid=${btoa(
            order.id
          )}`,
          cancel_url: BASE_URL,

          line_items: [
            {
              price_data: {
                currency: "aed",
                product_data: {
                  name: `New Order by ${customer.user.email}`,
                },
                unit_amount: fromDecToInt(body?.data?.totalAmount),
              },
              quantity: 1,
            },
          ],
        });
        checkoutUrl = session.url;
        deliveryParams.param.paymentMethod = "100";
        deliveryParams.param.collectingMoney = "0";
      }

      if (body?.data?.payment_method == 7) {
        const options = {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            Authorization: `Bearer ${process.env.TAP_SECRET_KEY}`,
          },
          body: JSON.stringify({
            amount: body?.data?.totalAmount,
            currency: "AED",
            customer_initiated: true,
            threeDSecure: true,
            save_card: false,
            description: `New Order by ${customer.user.email}`,
            receipt: { email: true, sms: true },
            customer: {
              first_name: customer.firstName,
              last_name: customer.lastName,
              email: customer.user.email,
            },
            source: { id: "src_all" },
            post: {
              url: `https://oneday.ae/success?orderid=${btoa(order.id)}`,
            },
            redirect: {
              url: `https://oneday.ae/success?orderid=${btoa(order.id)}`,
            },
          }),
        };
        await fetch("https://api.tap.company/v2/charges", options)
          .then((response) => response.json())
          .then((data) => {
            checkoutUrl = data.transaction.url;
            deliveryParams.param.paymentMethod = "100";
            deliveryParams.param.collectingMoney = "0";
          })
          .catch((err) => console.error(err));
      }
      // add all order items to created order
      for (const order_item of body?.data?.order_items) {
        // for each item reduce stock quantity
        const item = await strapi.entityService.findOne(
          order_item?.variation === 0
            ? "api::product.product"
            : "api::variation.variation",
          order_item?.variation === 0
            ? order_item?.product
            : order_item?.variation,
          {
            fields: ["*"],
            populate: ["seller", "product.seller", "price"],
          }
        );
        // console.log("previous stock =>", item);

        totalWeight =
          totalWeight + order_item?.variation === 0
            ? item?.weight != null
              ? item?.weight
              : 0
            : item?.product?.weight != null
            ? item?.product?.weight
            : 0;

        let officialProduct = order_item?.variation === 0 ? item : item.product;

        deliveryParams.param.skuDetailList.push({
          skuName: officialProduct.productName,
          skuNo:
            officialProduct.sku != null
              ? officialProduct.sku
              : officialProduct.slug,
          skuDesc: officialProduct.slug,
          skuQty: order_item.quantity,
          skuGoodsValue: order_item.subTotal,
          skuUrl: "",
        });
        deliveryParams.param.skuName +=
          officialProduct.sku != null
            ? officialProduct.sku + `*${order_item.quantity}|`
            : officialProduct.productName + `*${order_item.quantity}|`;
        console.log(
          officialProduct.productName +
            "|" +
            (officialProduct.sku != null ? officialProduct.sku : " ")
        );
        invoiceData.products.push({
          quantity: order_item.quantity,
          description:
            officialProduct.productName +
            "|" +
            (officialProduct.sku != null ? officialProduct.sku : " "),
          price: order_item.subTotal,
          "tax-rate": 0,
        });
        // if there is less stock then request
        if (
          item?.stock === null ||
          item?.stock === 0 ||
          item?.stock < order_item?.quantity
        ) {
          await strapi.entityService.delete("api::order.order", order?.id);

          return ctx.badRequest(
            "Stock Error",
            "insufficient stock, could not create order"
          );
        }

        const newStock = {
          stock: item?.stock - order_item?.quantity,
          sale: item?.sale + order_item?.quantity,
        };

        /*
          if order_item.variation !== 0 then reduce variant stock
          if order_item.variation === 0 then reduce product stock
        */
        let sellerObj =
          order_item?.variation === 0 ? item?.seller : item?.product?.seller;

        let reducedStock;
        if (order_item?.variation !== 0) {
          reducedStock = await strapi.entityService.update(
            "api::variation.variation",
            order_item?.variation,
            {
              data: {
                ...newStock,
              },
            }
          );
        } else {
          reducedStock = await strapi.entityService.update(
            "api::product.product",
            order_item?.product,
            {
              data: {
                ...newStock,
              },
            }
          );
          delete order_item.variation;
        }
        let addedOrderItem = await strapi.entityService.create(
          "api::order-item.order-item",
          {
            data: {
              ...order_item,
              order: order?.id,
              publishedAt: new Date(),
            },
          }
        );

        invoiceData.information.date = todaysDate;

        let sellerOrder = await strapi.entityService.findMany(
          "api::seller-orders.seller-orders",
          {
            filters: {
              seller: sellerObj?.id,
              order_date: todaysDate,
            },
            populate: ["order_items"],
          }
        );
        // console.log(sellerOrder);
        if (sellerOrder.length > 0) {
          const updatedSellerOrder = await strapi.entityService.update(
            "api::seller-orders.seller-orders",
            sellerOrder[0].id,
            {
              data: {
                order_items: [...sellerOrder[0].order_items, addedOrderItem.id],
              },
            }
          );
        } else {
          await strapi.entityService.create(
            "api::seller-orders.seller-orders",
            {
              data: {
                order_id: `orders-${todaysDate}-seller${sellerObj?.id}`,
                order_items: [addedOrderItem.id],
                seller: sellerObj?.id,
                order_status: "processing",
                order_date: todaysDate,
                publishedAt: new Date(),
              },
            }
          );
        }
      }

      deliveryParams.param.totalWeight = totalWeight;
      deliveryParams.param.orderCode = `OD-AE-${order?.id}`;
      invoiceData.information.number = `OD-AE-${order?.id}`;

      let tracking_id = null;
      let errorCreateB2cOrder = { status: false, message: "" };
      await fetch(`${IMILE_BASE_URL}/client/order/createB2cOrder`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(deliveryParams),
      })
        .then((response) => response.json())
        .then(async (data) => {
          // console.log(data);
          if (data.code == 200) tracking_id = data.data.expressNo;
          else {
            await strapi.entityService.delete("api::order.order", order?.id);
            errorCreateB2cOrder.status = true;
            errorCreateB2cOrder.message = data.message;
            console.log(data);
          }
        })
        .catch((err) => console.error(err));

      if (errorCreateB2cOrder.status) {
        return ctx.badRequest(
          "Address Validation Error",
          errorCreateB2cOrder.message
        );
      }
      if (body?.data?.payment_method == 2 || body?.data?.payment_method == 7) {
        const paymentLinkExpireDate = new Date();
        paymentLinkExpireDate.setMinutes(
          paymentLinkExpireDate.getMinutes() + LINK_EXPIRE
        );
        console.log(paymentLinkExpireDate);
        const job = schedule.scheduleJob(
          paymentLinkExpireDate,
          async function () {
            const newOrder = await strapi.entityService.findOne(
              "api::order.order",
              order.id
            );
            if (newOrder) {
              if (newOrder.payment_status == false) {
                await fetch(`${IMILE_BASE_URL}/client/order/deleteOrder`, {
                  method: "POST",
                  headers: {
                    accept: "application/json",
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({
                    ...DEFAULT_PARAMS,
                    param: {
                      orderCode: `OD-AE-${newOrder.id}`,
                      waybillNo: newOrder.tracking_id,
                    },
                  }),
                })
                  .then((response) => response.json())
                  .then(async (data) => {
                    console.log(data);
                    await strapi.entityService.update(
                      "api::order.order",
                      order?.id,
                      {
                        data: {
                          canceled: true,
                        },
                      }
                    );
                  })
                  .catch((err) => console.error(err));
              }
            }

            console.log(`Order ${order.id} is now canceled`);
          }
        );
      }
      let order_invoice = "";

      try {
        easyinvoice.createInvoice(invoiceData, async function (result) {
          let invoiceName =
            Math.floor(Math.random() * 1000000000) + "_invoice.pdf";

          fs.writeFileSync(
            `./public/uploads/${invoiceName}`,
            result.pdf,
            "base64"
          );
          let testUpload = await strapi
            .plugin("upload")
            .service("upload")
            .upload({
              data: {},
              files: {
                path: `${process.cwd()}/public/uploads/${invoiceName}`,
                name: "invoice.pdf",
                type: "application/pdf",
                size: fs.statSync(
                  `${process.cwd()}/public/uploads/${invoiceName}`
                ).size,
              },
            });
          fs.unlink(`${process.cwd()}/public/uploads/${invoiceName}`, (err) => {
            if (err) console.log(err);
            else {
              console.log("Invoice Deleted From Local");
            }
          });
          order_invoice = testUpload[0].url;
          await strapi.entityService.update("api::order.order", order?.id, {
            data: {
              order_invoice,
            },
          });
        });
      } catch (error) {
        return ctx.badRequest("Error while generating invoice", error);
      }

      let emailHtml = `
      <!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">

<head>
	<title></title>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0"><!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]--><!--[if !mso]><!-->
	<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@100;200;300;400;500;600;700;800;900" rel="stylesheet" type="text/css"><!--<![endif]-->
	<style>
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			padding: 0;
		}

		a[x-apple-data-detectors] {
			color: inherit !important;
			text-decoration: inherit !important;
		}

		#MessageViewBody a {
			color: inherit;
			text-decoration: none;
		}

		p {
			line-height: inherit
		}

		.desktop_hide,
		.desktop_hide table {
			mso-hide: all;
			display: none;
			max-height: 0px;
			overflow: hidden;
		}

		.image_block img+div {
			display: none;
		}

		@media (max-width:520px) {
			.desktop_hide table.icons-inner {
				display: inline-block !important;
			}

			.icons-inner {
				text-align: center;
			}

			.icons-inner td {
				margin: 0 auto;
			}

			.mobile_hide {
				display: none;
			}

			.row-content {
				width: 100% !important;
			}

			.stack .column {
				width: 100%;
				display: block;
			}

			.mobile_hide {
				min-height: 0;
				max-height: 0;
				max-width: 0;
				overflow: hidden;
				font-size: 0px;
			}

			.desktop_hide,
			.desktop_hide table {
				display: table !important;
				max-height: none !important;
			}
		}
	</style>
</head>

<body style="background-color: #fff; margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
	<table class="nl-container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #fff;">
		<tbody>
			<tr>
				<td>
					<table class="row row-1" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #d3ceca; border-radius: 0; color: #000; width: 500px; margin: 0 auto;" width="500">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 30px; padding-left: 30px; padding-right: 30px; padding-top: 30px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center" style="line-height:10px"><img src="https://oneday.ae/Logo.png" style="display: block; height: auto; border: 0; max-width: 242px; width: 100%;" width="242"></div>
															</td>
														</tr>
													</table>
													<table class="heading_block block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="padding-top:20px;text-align:center;width:100%;">
																<h3 style="margin: 0; color: #1e0e4b; direction: ltr; font-family: 'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif; font-size: 20px; font-weight: 700; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">Thank you for your order!</span></h3>
															</td>
														</tr>
													</table>
													<table class="heading_block block-3" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="text-align:center;width:100%;">
																<h3 style="margin: 0; color: #1e0e4b; direction: ltr; font-family: 'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif; font-size: 20px; font-weight: 700; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">${
                                  "OD-AE-" + order?.id
                                }</span></h3>
															</td>
														</tr>
													</table>
													<div class="spacer_block block-4" style="height:20px;line-height:20px;font-size:1px;">&#8202;</div>
													<table class="heading_block block-5" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="text-align:center;width:100%;">
																<h3 style="margin: 0; color: #1e0e4b; direction: ltr; font-family: 'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif; font-size: 20px; font-weight: 400; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">Hey! your order is now in processing</span></h3>
															</td>
														</tr>
													</table>
													<table class="heading_block block-6" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="text-align:center;width:100%;">
																<h3 style="margin: 0; color: #1e0e4b; direction: ltr; font-family: 'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif; font-size: 20px; font-weight: 400; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">you will get it in 2 to 7 working days</span></h3>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-2" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #ec6631; border-radius: 0; color: #000; width: 500px; margin: 0 auto;" width="500">
										<tbody>
											<tr>
												<td class="column column-1" width="33.333333333333336%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="heading_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<h3 style="margin: 0; color: #ffffff; direction: ltr; font-family: 'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">Order Date</span></h3>
															</td>
														</tr>
													</table>
													<table class="heading_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<h3 style="margin: 0; color: #1e0e4b; direction: ltr; font-family: 'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">${todaysDate}</span></h3>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-2" width="33.333333333333336%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="heading_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<h3 style="margin: 0; color: #ffffff; direction: ltr; font-family: 'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">Total Amount</span></h3>
															</td>
														</tr>
													</table>
													<table class="heading_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<h3 style="margin: 0; color: #1e0e4b; direction: ltr; font-family: 'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">${
                                  body?.data?.totalAmount
                                }</span></h3>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-3" width="33.333333333333336%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="heading_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<h3 style="margin: 0; color: #ffffff; direction: ltr; font-family: 'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">Payment Method</span></h3>
															</td>
														</tr>
													</table>
													<table class="heading_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<h3 style="margin: 0; color: #1e0e4b; direction: ltr; font-family: 'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">${
                                  body?.data?.payment_method == 2
                                    ? "Online"
                                    : "Cash On Delivery"
                                }</span></h3>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-3" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #d3ceca; border-radius: 0; color: #000; width: 500px; margin: 0 auto;" width="500">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 20px; padding-left: 20px; padding-right: 20px; padding-top: 20px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="paragraph_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#000000;direction:ltr;font-family:'Montserrat', 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', 'Lucida Sans', Tahoma, sans-serif;font-size:16px;font-weight:400;letter-spacing:0px;line-height:120%;text-align:center;mso-line-height-alt:19.2px;">
																	<p style="margin: 0; margin-bottom: 16px;">You can track you order by this tracking number: <a href="https://oneday.ae/track-my-order/${tracking_id}" target="_blank" style="text-decoration: underline; color: #ec6631;" rel="noopener">${tracking_id}</a></p>
																	<p style="margin: 0;">for more information contact us <a href="https://oneday.ae/contact-us" target="_blank" style="text-decoration: underline; color: #ec6631;" rel="noopener">HERE!</a></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					
				</td>
			</tr>
		</tbody>
	</table><!-- End -->
</body>

</html>
      `;

      await strapi.plugin("email").service("email").send({
        to: customer.user.email,
        from: "shopping@oneday.ae",
        subject: "Order Confirmed",
        html: emailHtml,
        // html: `<h4>Your Order is Confirmed</h4><br><p><b>Your tracking id is: </b>${tracking_id}</p><br><p><a href="https://oneday.ae/track-my-order/${tracking_id}">Track From Here</a></p>`,
      });

      let awb_label = "";
      await fetch(`${IMILE_BASE_URL}/client/order/batchRePrintOrder`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...DEFAULT_PARAMS,
          param: {
            customerId: DEFAULT_PARAMS.customerId,
            orderCodeList: [tracking_id],
            orderCodeType: 2,
          },
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          awb_label = data.data[0].label;
        })
        .catch((err) => console.error(err));

      const published = await strapi.entityService.update(
        "api::order.order",
        order?.id,
        {
          data: {
            tracking_id: tracking_id,
            publishedAt: new Date(),
            payment_link: checkoutUrl,
            awb_label,
          },
        }
      );
      // // return this.transformResponse(sanitizedResults);
      // // return { message: "order created!", data: customer };
      console.log(published);
      return {
        message: "order created!",
        data: published,
        payUrl: checkoutUrl,
      };
      // return "done";
    } catch (error) {
      console.error("error occurred : ", error);
      if (_.includes(error.name, "ValidationError")) {
        // throw new ValidationError(
        ctx.badRequest(
          "validation error",
          error?.details?.errors?.length
            ? error?.details?.errors.map(({ message, name }) => ({
                message,
                name,
              }))
            : {
                message: error.message,
                details: error.details,
              }
        );
      } else {
        throw new ApplicationError("⛔ something went wrong!");
      }
    }
  },
  async find(ctx) {
    const [customer] = await strapi.entityService.findMany(
      "api::customer.customer",
      {
        fields: ["id"],
        filters: { user: ctx.state.user?.id },
      }
    );
    ctx.query = {
      ...ctx.query,
      filters: { customer: customer?.id, ...ctx.query.filters },
    };
    const { data, meta } = await super.find(ctx);

    return { data, meta };
  },
  async findOne(ctx) {
    if (!ctx.state.isAuthenticated) {
      throw new ApplicationError("not authorized, you must be logged in");
    }
    //TODO: if null, could throw intermediate values
    const [customer] = await strapi.entityService.findMany(
      "api::customer.customer",
      {
        fields: ["id"],
        filters: { user: ctx.state.user?.id },
      }
    );

    ctx.query = {
      ...ctx.query,
      populate: [
        ...ctx.query?.populate,
        "deliveryAddress",
        "customer",
        "order_items.product.price",
        "order_items.product.productImages",
      ],
      filters: { customer: customer?.id },
    };
    try {
      // get order
      const order = await super.findOne(ctx);

      if (!order) {
        const error = new Error();
        error.name = "NotFound";
        error.data = order;
        error.message = `Order ID: ${ctx.request.params?.id} doesn't exist for customer : ${customer?.id}`;
        throw error;
      }

      return { data: order.data, meta: order.meta };
    } catch (error) {
      if (error.name === "NotFound") {
        ctx.badRequest("requested data not found", { moreDetails: error });

        // throw new NotFoundError("requested data not found", error);
      }
      ctx.badRequest("something went wrong", { moreDetails: error });

      // throw new ApplicationError("something went wrong", error);
    }
  },
  async update(ctx) {
    try {
      const { body } = ctx.request;

      // validate only authenticated users
      if (!ctx.state.isAuthenticated) {
        throw new UnauthorizedError("you must login first");
      }
      // console.log(ctx.params.id, ctx.query);
      const published = await strapi.entityService.update(
        "api::order.order",
        ctx.params.id,
        {
          data: body,
        }
      );

      return {
        data: "Order Updated Successfully",
      };
    } catch (error) {
      console.error("error occurred : ", error);
      if (_.includes(error.name, "ValidationError")) {
        throw new ValidationError(
          "validation error",
          error?.details?.errors?.length
            ? error?.details?.errors.map(({ message, name }) => ({
                message,
                name,
              }))
            : {
                message: error.message,
                details: error.details,
              }
        );
      } else {
        throw new ApplicationError("⛔ something went wrong!");
      }
    }
  },
}));
