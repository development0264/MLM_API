var admin = require("firebase-admin");
var serviceAccount = require('../serviceAccountKey.json');

var sendNotification = (registrationToken, payload) => {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        })
        admin.messaging().sendToDevice(registrationToken, payload)
    }
    catch (err) {

    }
}

module.exports = sendNotification;