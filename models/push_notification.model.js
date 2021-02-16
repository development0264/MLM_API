const mongoose = require('mongoose');
const schema = mongoose.Schema;

const pushNotificationSchema = new schema({
    udid: { type: String },
    registrationToken: { type: String },
    platform: { type: String },
    user_id: { type: String }
}, {
    timestamps: true,
})

const pushNotifications = mongoose.model('pushNotifications', pushNotificationSchema);
module.exports = pushNotifications;