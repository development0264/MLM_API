const mongoose = require('mongoose');
const schema = mongoose.Schema;

const autoCloseSchema = new schema({
    auto_close_days: { type: String },
    expires_in: { type: Number },
    amount_to_extend: { type: Number },
    amount_to_help_gc: { type: Number }
}, {
    timestamps: true,
})

const AutoClose = mongoose.model('AutoClose', autoCloseSchema);
module.exports = AutoClose;