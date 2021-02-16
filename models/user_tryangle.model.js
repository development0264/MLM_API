const mongoose = require('mongoose');
const schema = mongoose.Schema;

const TryangleSchema = new schema({
    plan_id: { type: String },
    user_id: { type: String },
    payment_id: { type: String },
    isTryangleCreated: { type: Boolean, default: false },
    is_one_joined: { type: Boolean, default: false },
    one_joined_at: { type: Date },
    parent_tryangle_id: { type: String },
    is_closed: { type: Boolean, default: false },
    is_manual_closed: { type: Boolean, default: false },
    is_tryangle_finished: { type: Boolean, default: false },
    finished_datetime: { type: Date },
    last_invited: { type: Date },
    is_initial_tryangle: { type: Boolean, default: false },
    tryangle_creation_datetime: { type: Date },
    is_cashout: { type: Boolean, default: false },
    tryangle_close_dateTime: { type: Date },
    last_activity: { type: String },
    auto_close_in: { type: String },
    did_parent_accepted_tryangle: { type: Boolean, default: false }
}, {
    timestamps: true,
})

const UserTrayangle = mongoose.model('UserTrayangle', TryangleSchema);
module.exports = UserTrayangle;
