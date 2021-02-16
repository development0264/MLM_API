const mongoose = require('mongoose');
const schema = mongoose.Schema;

const invitedUsersSchema = new schema({
    email: { type: String, require: true },
    plan_id: { type: String, require: true },
    parent_id: { type: String, require: true },
    user_id: { type: String },
    accepted_status: { type: Number, require: true },
    deleted_status: { type: Number, require: true },
    isLinkAlive: { type: Boolean, required: true, default: true },
    is_initial: { type: Boolean, required: true, default: false },
    acceptedAt: { type: Date },
    tryangle_id: { type: String }
}, {
    timestamps: true,
})

const InvitedUsers = mongoose.model('Invitedusers', invitedUsersSchema);
module.exports = InvitedUsers;