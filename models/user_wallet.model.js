const { database } = require('firebase-admin');
const mongoose = require('mongoose');
const { default: Stripe } = require('stripe');
const schema = mongoose.Schema;

const UserWalletSchema = new schema({
    user_id: { type: String },
    customer_id: { type: String },
    fund: { type: String },
    earning_uptillNow: { type: String },
    paypal_id: { type: String },
}, {
    timestamps: true,
})

const UserWallet = mongoose.model('UserWallet', UserWalletSchema);
module.exports = UserWallet;
