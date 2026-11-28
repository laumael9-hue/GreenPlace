const axios = require('axios');
const Paymongo = require('paymongo-node');

const secretKey = process.env.PAYMONGO_SECRET_KEY;
const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

const paymongo = Paymongo(secretKey);

const api = axios.create({
  baseURL: 'https://api.paymongo.com/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
  },
});

const METHOD_MAP = {
  paymongo_gcash: 'gcash',
  paymongo_maya: 'paymaya',
  paymongo_card: 'card',
};

const createPaymentIntent = async ({ amount, description, metadata = {} }) => {
  const response = await api.post('/payment_intents', {
    data: {
      attributes: {
        amount,
        currency: 'PHP',
        description,
        payment_method_allowed: ['gcash', 'paymaya', 'card'],
        capture_type: 'automatic',
        metadata,
      },
    },
  });

  const intent = response.data.data;
  return {
    id: intent.id,
    client_key: intent.attributes?.client_key,
    status: intent.attributes?.status,
  };
};

// Billing details (name/email/phone) are sent so PayMongo's risk checks see a real
// customer; anonymous e-wallet payments are more likely to be blocked.
const createPaymentMethod = async (type, billing = {}) => {
  const cleanBilling = Object.fromEntries(
    Object.entries(billing).filter(([, v]) => typeof v === 'string' && v.trim())
  );
  const attributes = { type };
  if (Object.keys(cleanBilling).length > 0) attributes.billing = cleanBilling;

  const response = await api.post('/payment_methods', {
    data: { attributes },
  });

  const method = response.data.data;
  return {
    id: method.id,
    type: method.attributes?.type,
  };
};

const attachPaymentMethod = async (paymentIntentId, paymentMethodId, returnUrl) => {
  const response = await api.post(`/payment_intents/${paymentIntentId}/attach`, {
    data: {
      attributes: {
        payment_method: paymentMethodId,
        return_url: returnUrl,
      },
    },
  });

  const intent = response.data.data;
  return {
    id: intent.id,
    status: intent.attributes?.status,
    client_key: intent.attributes?.client_key,
    next_action: intent.attributes?.next_action || null,
  };
};

// Pull PayMongo's human-readable reason out of an axios error, if there is one.
const getErrorDetail = (err) => {
  const first = err?.response?.data?.errors?.[0];
  return first ? { code: first.code, subCode: first.sub_code, detail: first.detail } : null;
};

const retrievePaymentIntent = async (id) => {
  const response = await api.get(`/payment_intents/${id}`);
  const intent = response.data.data;

  return {
    id: intent.id,
    amount: intent.attributes?.amount,
    status: intent.attributes?.status,
    client_key: intent.attributes?.client_key,
    next_action: intent.attributes?.next_action || null,
  };
};

const cancelPaymentIntent = async (id) => {
  const response = await api.post(`/payment_intents/${id}/cancel`);
  const intent = response.data.data;

  return {
    id: intent.id,
    status: intent.attributes?.status,
  };
};

const refundPayment = async (intentId, amountInCentavos, reason) => {
  const intentResponse = await api.get(`/payment_intents/${intentId}`);
  const payments = intentResponse.data.data?.attributes?.payments;
  const paymentId = payments?.[0]?.id;

  if (!paymentId) {
    throw new Error('No payment found for this intent');
  }

  const response = await api.post('/refunds', {
    data: {
      attributes: {
        amount: amountInCentavos,
        payment_id: paymentId,
        reason: reason || 'requested_by_customer',
      },
    },
  });

  const refund = response.data.data;
  return {
    id: refund.id,
    amount: refund.attributes?.amount,
    status: refund.attributes?.status,
  };
};

const verifyWebhook = ({ payload, signatureHeader }) => {
  return paymongo.webhooks.constructEvent({
    payload,
    signatureHeader,
    webhookSecretKey: webhookSecret,
  });
};

module.exports = {
  getErrorDetail,
  METHOD_MAP,
  createPaymentIntent,
  createPaymentMethod,
  attachPaymentMethod,
  retrievePaymentIntent,
  cancelPaymentIntent,
  refundPayment,
  verifyWebhook,
};
