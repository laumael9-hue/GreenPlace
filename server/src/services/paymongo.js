const Paymongo = require('paymongo-node');
const axios = require('axios');

const secretKey = process.env.PAYMONGO_SECRET_KEY;
const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
const isTestMode = process.env.PAYMONGO_TEST_MODE === 'true';

const paymongo = Paymongo(secretKey);

const api = axios.create({
  baseURL: 'https://api.paymongo.com/v1',
  timeout: 10000,
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
  const intent = await paymongo.paymentIntents.create({
    amount,
    currency: 'PHP',
    description,
    payment_method_allowed: ['gcash', 'paymaya', 'card'],
    capture_type: 'automatic',
    metadata,
  });

  return {
    id: intent.id,
    client_key: intent.client_key,
    status: intent.status,
  };
};

const createPaymentMethod = async (type, details = {}) => {
  const body = { data: { attributes: { type, ...details } } };
  const response = await api.post('/payment_methods', body);
  return response.data.data;
};

const attachPaymentMethod = async (paymentMethodId, paymentIntentId) => {
  const body = {
    data: {
      attributes: {
        payment_intent: paymentIntentId,
      },
    },
  };
  const response = await api.post(`/payment_methods/${paymentMethodId}/attach`, body);
  return response.data.data;
};

const retrievePaymentIntent = async (id) => {
  const intent = await paymongo.paymentIntents.retrieve(id);
  return {
    id: intent.id,
    amount: intent.amount,
    status: intent.status,
    client_key: intent.client_key,
    payments: intent.payments,
    next_action: intent.next_action,
  };
};

const cancelPaymentIntent = async (id) => {
  const intent = await paymongo.paymentIntents.cancel(id);
  return {
    id: intent.id,
    status: intent.status,
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
  verifyWebhook,
  isTestMode,
};
