const { text } = require('express');
const mongoose = require('mongoose');

const schema = mongoose.Schema;

const TyanglesSchema = new schema({
    plan_id: { type: String, require: true },
    parent_id: { type: String },
    user_id: { type: String },
    status: { type: Number },
    email: { type: String },
    phone: { type: String },
    deleted_status: { type: Number }
}, {
    timestamps: true,
})

const Tryangle = mongoose.model('tryangle_members', TyanglesSchema);
module.exports = Tryangle;
