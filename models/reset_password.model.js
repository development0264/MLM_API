const mongoose = require('mongoose');
const schema = mongoose.Schema;

const resetPasswordSchema = new schema({
    user_id: { type: String },
    email: { type: String },
    token: { type: String }
}, {
    timestamps: true,
})

const ResetPassword = mongoose.model('ResetPassword', resetPasswordSchema);
module.exports = ResetPassword;