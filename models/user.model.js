const { text } = require('express');
const mongoose = require('mongoose');

const schema = mongoose.Schema;

const userSchema = new schema({
    first_name: { type: String, require: true },
    last_name: { type: String, require: true },
    email: { type: String, require: true },
    social_id: { type: String, require: true },
    profile_photo: { type: String, require: true },
    type: { type: String, require: true },
    password: { type: String },
    status: { type: Number, required: true },
    isLinkAlive: { type: Boolean, required: true, default: true },
    isPhotoUpdated: { type: Boolean, required: true, default: false },
    paypal_id: { type: String },
    last_activity: {type: String}
}, {
    timestamps: true,
})

const User = mongoose.model('User', userSchema);
module.exports = User;
