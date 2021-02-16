const mongoose = require('mongoose');

const schema = mongoose.Schema;

const userplanSchema = new schema({
    user_id: { type: String, require: true },
    plan_id: { type: String, required: false },
    plan_amount: { type: String, require: false },
    description: { type: String },
    purchased_status: { type: String, required: false },
    payment_id: { type: String, require: false },
    payment_state: { type: String, require: false },
    payment_card: { type: String, require: false },
    payment_method: { type: String, require: false },
    payment_status: { type: String, require: false },
    purchased_status: { type: String, require: false },
    payer_id: { type: String, require: false },
    payer_email: { type: String, require: false },
    payer_first_name: { type: String, require: false },
    payer_last_name: { type: String, require: false },
    transaction_amount: { type: String, require: false },
    transaction_amount_currency: { type: String, require: false },
    transaction_tax: { type: String, require: false },
    tryangle_id: { type: String }
}, {
    timestamps: true,
})

const UserPlans = mongoose.model('user_payments', userplanSchema);
module.exports = UserPlans;