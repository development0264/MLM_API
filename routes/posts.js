const router = require('express').Router();
const verify = require('./verifyToken')
const sendNotification = require('../commonfunctions/sendPushNotification');
const UserTryangle = require('../models/user_tryangle.model');
const PushNotification = require('../models/push_notification.model');
const u = require('underscore');
const apnProvider = require('../commonfunctions/APN_notification');

router.get('/', verify, (req, res) => {
    res.json({
        status: true,
        posts: {
            title: 'My first post',
            description: 'random data for testing'
        }
    });
});

router.post('apnNotification', async (req, res) => {
    try {
        const deviceTokens = 'a9d0ed10e9cfd022a61cb08753f49c5a0b0dfb383697bf9f9d750a1003da19c7';

        let notification = new apn.Notification({
            alert: {
                title: 'Hello World',
                body: 'Hello world body'
            },
            topic: 'com.org.appName',
            payload: {
                "sender": "node-apn",
            },
            pushType: 'background'
        });

        apnProvider.send(notification, deviceTokens).then(response => {
            console.log(response.sent);
            console.log(response.failed);
        });

        res.json({
            processed: true
        });

    } catch (e) {
        next(e);
    }
})

router.post('/firebase/notification', async (req, res) => {
    await UserTryangle.findOneAndUpdate({ _id: '5f9d32024ea1a62bdcbcd783' },
        {
            $set: {
                is_tryangle_finished: true

            }
        }).then(async (data) => {
            const registrationToken = u.pluck(await PushNotification.find({ user_id: data.user_id }), 'registrationToken');
            console.log(registrationToken);
            var payload = {
                notification: {
                    title: "Tryangle Finished",
                    body: "Your tryangle has been completed."
                }
            };
            sendNotification(registrationToken, payload)
        });
})

module.exports = router;
