const apn = require('apn');

try {
    const apnOptions = {
        token: {
            key: "AuthKey_N9J9Y592LN.p8",
            keyId: process.env.APN_KEY_ID,
            teamId: process.env.APN_TEAM_ID
        },
        production: false
    };
    var apnProvider = new apn.Provider(apnOptions)
}
catch (err) {
    console.log(err);
}

module.exports = apnProvider;