const mongoose = require('mongoose');
const schema = mongoose.Schema;

const planSchema = new schema({
    plan_title: { type: String, require: true },
    plan_description: { type: String, require: true },
    plan_amount: { type: Number, required: true }
}, {
    timestamps: true,
})

const Plan = mongoose.model('Plans', planSchema);
module.exports = Plan;
