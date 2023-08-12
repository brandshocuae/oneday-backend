"use strict";

/**
 * order controller
 */
const { createCoreController } = require("@strapi/strapi").factories;
const _ = require("lodash");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.SECRET_TEST_KEY);
const fetch = require("node-fetch");
const schedule = require("node-schedule");
const easyinvoice = require("easyinvoice");

// validation
const { yup, validateYupSchema, errors } = require("@strapi/utils");

const { ApplicationError, ValidationError, NotFoundError } = errors;

const LINK_EXPIRE = 30;
const IMILE_BASE_URL = "https://openapi.52imile.cn";
// const DELIVERY_URL = "https://openapi.imile.com"

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
      },
      sender: {
        company: "ONEDAY AE",
        address: "Sample Street 123",
        zip: "1234 AB",
        city: "Sampletown",
        country: "UAE",
      },
      images: {
        logo: "https://oneday.ae/Logo.png",
      },

      information: {
        date: "12-12-2021",
        "due-date": "31-12-2021",
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
        consignorContact: "ONEDAY",
        consignorPhone: "123456789",
        consignorMobile: "",
        consignorCountry: "UAE",
        consignorProvince: "",
        consignorCity: "Dubai",
        consignorArea: "",
        consignorAddress:
          "الرياض - السليمانية- حي الملك عبدالعزيز  خلف محطة سهل- مبني رقم",
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
        invoiceData.products.push({
          quantity: order_item.quantity,
          description: officialProduct.productName,
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
      deliveryParams.param.skuName = `OD-AE-${order?.id}`;
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
      easyinvoice.createInvoice(invoiceData, async function (result) {
        order_invoice = "data:application/pdf;base64," + result.pdf;
      });

      await strapi
        .plugin("email")
        .service("email")
        .send({
          to: customer.user.email,
          from: "mailer@oneday.ae",
          subject: "Order Confirmed",
          html: `<h4>Your Order is Confirmed</h4><br><p><b>Your tracking id is: </b>${tracking_id}</p><br><p><a href="https://oneday.ae/track-my-order/${tracking_id}">Track From Here</a></p>`,
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
            order_invoice: order_invoice,
          },
        }
      );

      // // return this.transformResponse(sanitizedResults);
      // // return { message: "order created!", data: customer };
      return {
        message: "order created!",
        data: published.id,
        payUrl: checkoutUrl,
      };
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
