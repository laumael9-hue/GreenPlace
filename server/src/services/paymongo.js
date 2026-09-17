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
  console.log('PayMongo intent created:', intent.id, 'status:', intent.attributes?.status);

  return {
    id: intent.id,
    client_key: intent.attributes?.client_key,
    status: intent.attributes?.status,
  };
};

const createPaymentMethod = async (type) => {
  const response = await api.post('/payment_methods', {
    data: { attributes: { type } },
  });

  const method = response.data.data;
  console.log('PayMongo method created:', method.id, 'type:', method.attributes?.type);

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
  console.log('PayMongo attached:', intent.id, 'status:', intent.attributes?.status);

  return {
    id: intent.id,
    status: intent.attributes?.status,
    client_key: intent.attributes?.client_key,
    next_action: intent.attributes?.next_action || null,
  };
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
  console.log('PayMongo refund created:', refund.id, 'status:', refund.attributes?.status);

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
  METHOD_MAP,
  createPaymentIntent,
  createPaymentMethod,
  attachPaymentMethod,
  retrievePaymentIntent,
  cancelPaymentIntent,
  refundPayment,
  verifyWebhook,
};
