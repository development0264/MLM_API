const router = require('express').Router();
let User = require('../models/user.model');
let InvitedUsers = require('../models/invited_users.model');
let Plan = require('../models/plans.model');
const UserTrayangle = require('../models/user_tryangle.model');
const PushNotification = require('../models/push_notification.model');
const UserWallet = require('../models/user_wallet.model');
const UserPayment = require('../models/user_payments.model');
const ResetPassword = require('../models/reset_password.model');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const verify = require('./verifyToken');
const jwt = require('jsonwebtoken');
var multer = require('multer');
const bcrypt = require("bcrypt");
const config = require('../commonfunctions/config');
const sendMail = require('../commonfunctions/sendMail');
const sendNotification = require('../commonfunctions/sendPushNotification');
const { validationResult } = require('express-validator')
const client = new OAuth2Client(config.client_id);
const axios = require('axios');
const u = require('underscore');
const jwksClient = require('jwks-rsa');
const braintree = require("braintree");
const paypal = require('@paypal/payouts-sdk');
const TokenGenerator = require('uuid-token-generator');
const apnProvider = require('../commonfunctions/APN_notification');
const apn = require('apn');
const formidable = require('formidable');
const fs = require('fs');

/* Verify token for apple sign in */
function verifyJWT(json, publickey) {
    return new Promise((resolve) => {
        jwt.verify(json, publickey, (err, payload) => {
            if (err) {
                return resolve(null);
            }

            resolve(payload);
        })
    })
}

/* To upload profile photo */
/* To upload profile photo */
var storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        await cb(null, 'profileImages/')
    },
    filename: async function (req, file, cb) {
        await cb(null, Date.now() + file.originalname)
    }
})

const fileFilter = async function (req, file, cb) {
    /* Accept images only */
    if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG)$/)) {
        req.fileValidationError = 'Only image files are allowed!';
        return cb(new Error('Only image(jpg|JPG|jpeg|JPEG|png|PNG) files are allowed!'), false);
    }
    await cb(null, true);
}

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
});

// console.log('upload------>', upload);
// var upload = multer({
//     storage: storage,
//     fileFilter: function (req, file, cb) {
//         /* Accept images only */
//         if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG)$/)) {
//             req.fileValidationError = 'Only image files are allowed!';
//             return cb(new Error('Only image(jpg|JPG|jpeg|JPEG|png|PNG) files are allowed!'), false);
//         }
//         cb(null, true);
//     }
// });


/* Get all user details */
router.get('/', verify, function (req, res) {
    User.find()
        .then(users => {
            var data = { users };

            res.status(200).json({ status: true, data: data });
        }).catch(err => res.status(401).json({ status: false, Error: + err }))
});

router.get('/filterUser', verify, async (req, res) => {

    const totalData = await User.find({ type: { $ne: 'admin' } }).countDocuments();
    console.log(totalData);
    await User.find({ type: { $ne: 'admin' } }).skip(parseInt(req.body.start)).limit(parseInt(req.body.length)).sort({ createdAt: -1 })
        .then(projects => {
            res.status(200).send({ status: true, data: projects, length: totalData });
        })
})

/* Get single user details */
router.get('/:id', verify, function (req, res) {
    console.log(req.params.id);
    User.findById(req.params.id)
        .then(user => res.status(200).json({ status: true, data: user }))
        .catch(err => res.status(401).json({ status: false, Error: + err }))
});

/* To verify if email exists in our DB or not */
router.post('/verifyemail', config.vadidateEmail, async (req, res) => {
    const errors = validationResult(req);
    const email = req.body.email.toLowerCase();
    var data = {
        email: email
    };

    if (errors.errors.length > 0) {
        res.status(400).json({ status: false, errors: errors.array() })
    }
    else {
        User.findOne(data, function (err, user) {
            if (err) {
                res.status(401).json({ status: false, errors: err })
            } else {
                if (user === null) {
                    res.status(401).json({ status: false, message: 'Your email did not found in our system' })
                } else {
                    res.status(200).json({ status: true, data: user })
                }
            }
        })
    }
});

router.route('/:id').delete((req, res) => {
    User.findByIdAndDelete(req.params.id)
        .then(user => res.status(200).json({ status: true, message: 'User deleted' }))
        .catch(err => res.status(401).json({ status: false, errors: err }));
});

router.post('/user_lastActivity', async (req, res) => {
    const user_id = req.body.user_id;
    try {
        const last_activity = await User.findById({ _id: user_id }, { last_activity: 1 });
        res.status(200).send({ status: true, data: last_activity });
    }
    catch (err) {
        res.status(401).send({ status: false, message: 'something went wrong.' });
    }
})

/* Check if email is valid or not */
router.get('/confirmemail/:id', async (req, res) => {
    const htmlText = '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '  <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&amp;display=swap" rel="stylesheet">' +
        '  <style type="text/css">' +
        '     * {' +
        '     box-sizing: border-box;' +
        '     }' +
        '  </style>' +
        '</head>' +
        '<body style="background-color: #dddddd;margin: 0;">' +
        '   <div style="max-width: 680px;margin: 20px auto;background-color: #fff;padding: 40px 40px; width: 100%">' +
        '     <div>' +
        '      <img src="' + config.myIP + '/uploads/logo/LOGO.png">' +
        '     </div>' +
        '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Congratulations, You have verified your Email</p>' +
        '<span style="background-color: #9B51E0;' +
        '                  text-decoration: none;' +
        '                  display: inline-block;' +
        '                  color: #fff;' +
        '                  font-family: Rubik, sans-serif;' +
        '                  font-size: 14px;' +
        '                  padding: 8px 15px;' +
        '                  border-radius: 10px;">' +
        '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=" style="text-decoration: none;color:#fff">Get Started</a>' +
        '</span>' +
        '     <div style="' +
        '        display: flex;' +
        '        align-items: self-start;' +
        '        ">' +
        '        <div style="' +
        '           position: relative;' +
        '           padding-top: 28px;' +
        '           ">' +
        '      <p style="' +
        '         border-top: 1px solid #F0F3F7;' +
        '         margin: 30px 0 0 0;' +
        '         padding-top: 15px;' +
        '         color: #8593A6;' +
        '         font-family: Rubik, sans-serif;' +
        '         font-weight: 400;' +
        '         font-size: 12px;' +
        '         ">This email was sent to you as a registered member of tryangle.co. To update your emails preferences <a href="#" style="' +
        '         color: #0052E2;' +
        '         text-decoration: none;' +
        '         ">click here</a>. Use of the service and website is subject to our <a href="' + config.myIP + '/uploads/general-terms.html" style="' +
        '         color: #0052E2;' +
        '         text-decoration: none;' +
        '         ">Terms of Use</a> and <a href="' + config.myIP + '/uploads/privacy-policy.html" style="' +
        '         color: #0052E2;' +
        '         text-decoration: none;' +
        '         ">Privacy Statement</a>.</p>' +
        '      <p style="' +
        '         color: #8593A6;' +
        '         font-family: Rubik, sans-serif;' +
        '         font-weight: 400;' +
        '         font-size: 12px;' +
        '         margin: 20px 0 0 0;' +
        '         ">© 2020  , LLC. All rights reserved</p>' +
        '   </div >' +
        '</body >' +
        '</html > '


    User.findById(req.params.id)
        .then(user => {
            user.status = 1;

            user.save()
                .then(() => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.write(htmlText);
                    res.end();
                    // res.status(200).json({ status: true, message: htmlText })
                })
                .catch(err => res.status(401).json({ status: false, Errors: err }))
        })
        .catch(err => res.status(401).json({ status: false, Errors: err }))
})

/* To resend account verification email */
router.post('/resend_confirmationLink', async (req, res) => {
    const user_id = req.body.user_id;
    const userDetail = await User.findById({ _id: user_id });

    if (userDetail.first_name && userDetail.email && user_id) {
        // var htmlText = '<h2>Hello ' + userDetail.first_name + '</h2> <p>Please <a href="' + config.myIP + '/api/users/confirmemail/' + user_id + '">click here</a> to verify your email.</p><h5>Thanks</h5>'
        var htmlText = '<!DOCTYPE html>' +
            '<html>' +
            '<head>' +
            '  <title>Welcome to the Tryangle</title>' +
            '  <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&amp;display=swap" rel="stylesheet">' +
            '  <style type="text/css">' +
            '     * {' +
            '     box-sizing: border-box;' +
            '     }' +
            '  </style>' +
            '</head>' +
            '<body style="background-color: #dddddd;margin: 0;">' +
            '   <div style="max-width: 680px;margin: 20px auto;background-color: #fff;padding: 40px 40px; width: 100%">' +
            '     <div>' +
            '      <img src="' + config.myIP + '/uploads/logo/LOGO.png">' +
            '     </div>' +
            '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Well well ' + userDetail.first_name + ', Welcome to Tryangle - the Community Based Giving & Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.Ready to try it?</p>' +
            '<span style="background-color: #9B51E0;' +
            '                  text-decoration: none;' +
            '                  display: inline-block;' +
            '                  color: #fff;' +
            '                  font-family: Rubik, sans-serif;' +
            '                  font-size: 14px;' +
            '                  padding: 8px 15px;' +
            '                  border-radius: 10px;">' +
            '     <a href="' + config.myIP + '/api/users/confirmemail/' + user_id + '" style="text-decoration: none;color:#fff">Verify Email</a>' +
            '</span>' +
            '     <div style="' +
            '        display: flex;' +
            '        align-items: self-start;' +
            '        ">' +
            '        <div style="' +
            '           position: relative;' +
            '           padding-top: 28px;' +
            '           ">' +
            '      <p style="' +
            '         border-top: 1px solid #F0F3F7;' +
            '         margin: 30px 0 0 0;' +
            '         padding-top: 15px;' +
            '         color: #8593A6;' +
            '         font-family: Rubik, sans-serif;' +
            '         font-weight: 400;' +
            '         font-size: 12px;' +
            '         ">This email was sent to you as a registered member of tryangle.co. To update your emails preferences <a href="#" style="' +
            '         color: #0052E2;' +
            '         text-decoration: none;' +
            '         ">click here</a>. Use of the service and website is subject to our <a href="' + config.myIP + '/uploads/general-terms.html" style="' +
            '         color: #0052E2;' +
            '         text-decoration: none;' +
            '         ">Terms of Use</a> and <a href="' + config.myIP + '/uploads/privacy-policy.html" style="' +
            '         color: #0052E2;' +
            '         text-decoration: none;' +
            '         ">Privacy Statement</a>.</p>' +
            '      <p style="' +
            '         color: #8593A6;' +
            '         font-family: Rubik, sans-serif;' +
            '         font-weight: 400;' +
            '         font-size: 12px;' +
            '         margin: 20px 0 0 0;' +
            '         ">© 2020  , LLC. All rights reserved</p>' +
            '   </div >' +
            '</body >' +
            '</html > '
        // var htmlText = '<h2>Hello ' + userDetail.first_name + '</h2> <p>Please <a href="' + config.myIP + '/api/users/confirmemail/' + user_id + '">click here</a> to verify your email.</p><h5>Thanks</h5>'
        // var htmlText = ''
        var subject = 'Welcome to the Tryangle';
        var toMail = userDetail.email;
        sendMail(toMail, subject, htmlText);
        res.status(200).send({ status: true, message: 'Email resent.' })
    }
    else {
        res.status(400).send({ status: false, message: 'Invalid userDetail.' })
    }
})

/* To update single user detail */
router.post('/update/:id', async (req, res, next) => {
    try {
        console.log('update');
        let newPath;
        let countError = 0;
        let countSuccess = 0;
        let userDetail;
        let coundInputField;
        const form = new formidable.IncomingForm();

        form.parse(req, function (err, fields, files) {
            console.log('fields --->', fields);
            console.log('files ---->', files);
            User.findById(req.params.id)
                .then(async (user) => {
                    console.log('user ----> ', user);
                    coundInputField = Object.keys(fields).length + Object.keys(files).length;
                    console.log('coundInputField ----> ', coundInputField);
                    if (fields.first_name) {
                        const first_nameUpdated = await User.findByIdAndUpdate({ _id: req.params.id }, { $set: { first_name: fields.first_name } });
                        console.log('first_nameUpdated ----> ', first_nameUpdated);
                        if (first_nameUpdated) {
                            countSuccess++;
                            if (countSuccess == coundInputField) {
                                userDetail = await User.findById({ _id: req.params.id });
                                console.log('userDetail ---->', userDetail);
                                res.status(200).json({ status: true, message: 'user details successfully updated!!', data: userDetail })
                            }
                        }
                    }
                    if (fields.last_name) {
                        console.log('fields.last_name ----> ', fields.last_name);
                        const last_nameUpdated = await User.findByIdAndUpdate({ _id: req.params.id }, { $set: { last_name: fields.last_name } });
                        if (last_nameUpdated) {
                            countSuccess++;
                            if (countSuccess == coundInputField) {
                                userDetail = await User.findById({ _id: req.params.id });
                                console.log('userDetail 1---->', userDetail);
                                res.status(200).json({ status: true, message: 'user details successfully updated!!', data: userDetail })
                            }
                        }
                    }
                    console.log('fields.paypal_id----->', fields.paypal_id);
                    if (fields.paypal_id || fields.paypal_id != '' || fields.paypal_id != undefined) {
                        const paypal_idUpdated = await User.findByIdAndUpdate({ _id: req.params.id }, { $set: { paypal_id: fields.paypal_id } });
                        await UserWallet.findOneAndUpdate({ user_id: req.params.id }, { $set: { paypal_id: fields.paypal_id } });

                        if (paypal_idUpdated) {
                            countSuccess++;
                            if (countSuccess == coundInputField) {
                                userDetail = await User.findById({ _id: req.params.id });
                                console.log('userDetail 2---->', userDetail);
                                res.status(200).json({ status: true, message: 'user details successfully updated!!', data: userDetail })
                            }
                        }
                    }
                    if (files.profile_photo) {
                        console.log('files.profile_photo ----> ', files.profile_photo);
                        const ext = files.profile_photo.type.split("/")[0];
                        console.log('ext---->', ext);
                        if (ext == 'image') {
                            var oldPath = files.profile_photo.path;
                            newPath = 'profileImages/' + Date.now() + files.profile_photo.name;
                            console.log('oldPath---->', oldPath);
                            console.log('newPath---->', newPath);
                            var rawData = fs.readFileSync(oldPath)
                            console.log('rawData---->', rawData);
                            fs.writeFile(newPath, rawData, function (err) {
                                if (err) {
                                    countError++;
                                }
                                return countError;
                            });
                            console.log('countError---->', countError);
                            if (countError == 0) {
                                const photoUpdated = await User.findByIdAndUpdate({ _id: req.params.id }, { $set: { profile_photo: newPath, isPhotoUpdated: true } });
                                console.log('photoUpdated---->', photoUpdated);
                                if (photoUpdated) {
                                    console.log('photoUpdated---->');
                                    countSuccess++;
                                    console.log('countSuccess---->', countSuccess);
                                    console.log('coundInputField---->', coundInputField);
                                    if (countSuccess == coundInputField) {
                                        console.log('ext---->', ext);
                                        userDetail = await User.findById({ _id: req.params.id });
                                        console.log('userDetail 3---->', userDetail);
                                        res.status(200).json({ status: true, message: 'user details successfully updated!!', data: userDetail })
                                    }
                                }
                            }
                        }
                        else {
                            res.status(401).json({
                                status: false,
                                message: 'Only image files are allowed!'
                            })
                            return;
                        }
                    }
                })
                .catch(err => res.status(401).json({ status: false, message: 'User does not exists' }))
        });
    }
    catch (err) {
        cres.status(401).json({ status: false, message: 'Something Went Wrong.', error: err.message })
    }
})


/* To register new user with email, google or apple */
router.post('/register', upload.single('profile_photo'), async (req, res, next) => {
    var errors = validationResult(req);
    if (errors.errors.length > 0) {
        return res.status(401).json({ status: false, errors: errors.array() })
    } else {
        /* get file and other fields */
        var profileImageinfo = req.file;
        var type = req.body.type;
        var paypal_id = req.body.paypal_id;
        var googleError = false;
        var emailExists = false;
        var facebooknewuser;
        var newUser;
        var newAppleUser;
        var savedUser;

        if (profileImageinfo !== undefined) {
            var profile_photo = profileImageinfo.filename;
        } else {
            var profile_photo = '';
        }

        if (type === undefined || type === null || type === '') {
            res.status(401).send({ status: false, message: 'type of register via google or email is required ' })
        } else {
            if (type == 'email') {
                var first_name = req.body.first_name;
                var last_name = req.body.last_name;
                var email = req.body.email.toLowerCase();
                var status = 0;
                var password = req.body.password;
                var validationError = false;
                var validationMessage = '';

                if (first_name === null || first_name === undefined || first_name === '') {
                    validationError = true;
                    validationMessage = 'Firstname is required ';
                }

                if (last_name === null || last_name === undefined || last_name === '') {
                    validationError = true;
                    validationMessage += 'Lastname is required ';
                }

                if (email === null || email === undefined || email === '') {
                    validationError = true;
                    validationMessage += 'Email is required ';
                }

                if (password === null || password === undefined || password === '') {
                    validationError = true;
                    validationMessage += 'Password is required';
                }

                if (validationError) {
                    res.status(401).send({ status: false, message: validationMessage });
                } else {
                    const saltRounds = 10;
                    const pwd = req.body.password;
                    password = await bcrypt.hash(pwd, saltRounds);

                    var checkEmail = await User.find({ email: email });
                    if (checkEmail.length > 0) {
                        emailExists = true;
                    } else {
                        newUser = new User({ first_name, last_name, email, profile_photo, type, password, status, paypal_id });
                    }
                }
            }

            else if (type == 'apple') {
                var appletoken = req.body.token;

                if (appletoken === undefined || appletoken === null || appletoken === '') {
                    res.status(401).send({ status: false, message: 'Apple token is required' });
                } else {
                    const json = jwt.decode(appletoken, { complete: true });
                    const kid = json.header.kid;

                    const client = jwksClient({
                        jwksUri: 'https://appleid.apple.com/auth/keys'
                    });
                    client.getSigningKey(kid, async (err, key) => {
                        if (err) {
                            return err;
                        }
                        const signingKey = key.rsaPublicKey;
                        if (!signingKey || signingKey == null) {
                            res.status(404).send({ status: false, message: 'Something went wrong!' });
                            return
                        }
                        const applePayload = await verifyJWT(appletoken, signingKey);

                        if (applePayload == null) {
                            res.status(404).send({ status: false, message: 'User not found' });
                            return;
                        }
                        // else if (applePayload.sub == req.body.social_id) {
                        let is_private_email = req.body.is_private_email;
                        let checkEmail;
                        let emailID;
                        let sendEmail = false;
                        let emailStatus;

                        if (is_private_email == 'true') {
                            emailStatus = 0;
                            sendEmail = true;
                            emailID = req.body.email;
                            checkEmail = await User.findOne({ email: emailID });
                        }
                        else {
                            emailStatus = 1;
                            emailID = applePayload.email;
                            checkEmail = await User.findOne({ email: emailID });
                        }
                        if (checkEmail !== null) {
                            savedUser = checkEmail;
                        } else {
                            const status = emailStatus;
                            const first_name = req.body.first_name;
                            const last_name = req.body.last_name;
                            const profile_photo = req.profile_photo;
                            const email = emailID.toLowerCase();;
                            const social_id = applePayload.sub;
                            const paypal_id = req.body.paypal_id;
                            const saltRounds = 10;
                            const pwd = req.body.password;
                            const password = await bcrypt.hash(pwd, saltRounds);
                            newAppleUser = new User({ first_name, last_name, profile_photo, email, password, paypal_id, social_id, status, type });
                            savedUser = await newAppleUser.save();
                            // const customer = await stripe.customers.create({
                            //     email: savedUser.email,
                            //     name: savedUser.first_name,
                            //     description: 'New Customer',
                            // });

                            var walletUser = new UserWallet({
                                user_id: savedUser._id,
                                // customer_id: customer.id,
                                fund: 0,
                                earning_uptillNow: 0,
                                paypal_id: savedUser.paypal_id
                            });
                            await walletUser.save();

                            /* Check the registering user's email is exists in invited table or not */
                            var checkInvited = await InvitedUsers.find({ email: savedUser.email });
                            if (checkInvited.length > 0) {
                                await InvitedUsers.updateMany({ email: savedUser.email },
                                    {
                                        $set: {
                                            user_id: savedUser._id
                                        }
                                    }
                                );
                            }

                            // /*  Get Registration Token */
                            // const registrationToken = u.pluck(await PushNotification.find({ user_id: savedUser._id }), 'registrationToken')
                            // /* Send Notification */
                            // var payload = {
                            //     notification: {
                            //         title: "Tryangle Registration",
                            //         body: "You have successfully Registered in our system."
                            //     }
                            // };
                            // sendNotification(registrationToken, payload);
                        }

                        /* Generate JWT token */
                        const token = await jwt.sign({ _id: email }, process.env.TOKEN_SECRET);
                        /* return json data */
                        var userData = new Object();
                        userData['_id'] = savedUser._id;
                        userData['first_name'] = savedUser.first_name;
                        userData['last_name'] = savedUser.last_name;
                        userData['email'] = savedUser.email;
                        userData['social_id'] = savedUser.social_id;
                        userData['profile_photo'] = savedUser.profile_photo;
                        userData['social_id'] = savedUser.social_id;
                        userData['type'] = savedUser.type;
                        userData['status'] = savedUser.status;
                        userData['createdAt'] = savedUser.createdAt;
                        userData['paypal_id'] = savedUser.paypal_id;


                        if (sendEmail) {
                            var htmlText = '<!DOCTYPE html>' +
                                '<html>' +
                                '<head>' +
                                '  <title>Welcome to the Tryangle</title>' +
                                '  <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&amp;display=swap" rel="stylesheet">' +
                                '  <style type="text/css">' +
                                '     * {' +
                                '     box-sizing: border-box;' +
                                '     }' +
                                '  </style>' +
                                '</head>' +
                                '<body style="background-color: #dddddd;margin: 0;">' +
                                '   <div style="max-width: 680px;margin: 20px auto;background-color: #fff;padding: 40px 40px; width: 100%">' +
                                '     <div>' +
                                '        <img src="' + config.myIP + '/uploads/logo/LOGO.png">' +
                                '     </div>' +
                                // '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Well well ' + savedUser.first_name + ', Welcome to Tryangle - the Community Based Giving & Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.Ready to try it? Please <a href="' + config.myIP + '/api/users/confirmemail/' + savedId + '">click here</a> to verify your email</p>' +
                                '<p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Well well ' + savedUser.first_name + ',<br/> Welcome to Tryangle - the Community Based Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.<br/>Ready to try it?</p>' +
                                '<span style="background-color: #9B51E0;' +
                                '                  text-decoration: none;' +
                                '                  display: inline-block;' +
                                '                  color: #fff;' +
                                '                  font-family: Rubik, sans-serif;' +
                                '                  font-size: 14px;' +
                                '                  padding: 8px 15px;' +
                                '                  border-radius: 10px;">' +
                                '    <a href="' + config.myIP + '/api/users/confirmemail/' + savedUser._id + '" style="text-decoration: none;color:#fff">verify your email</a>' +
                                '</span>' +
                                '     <div style="' +
                                '        display: flex;' +
                                '        align-items: self-start;' +
                                '        ">' +
                                '        <div style="' +
                                '           position: relative;' +
                                '           padding-top: 28px;' +
                                '           ">' +
                                '      <p style="' +
                                '         border-top: 1px solid #F0F3F7;' +
                                '         margin: 30px 0 0 0;' +
                                '         padding-top: 15px;' +
                                '         color: #8593A6;' +
                                '         font-family: Rubik, sans-serif;' +
                                '         font-weight: 400;' +
                                '         font-size: 12px;' +
                                '         ">This email was sent to you as a registered member of tryangle.co. To update your emails preferences <a href="#" style="' +
                                '         color: #0052E2;' +
                                '         text-decoration: none;' +
                                '         ">click here</a>. Use of the service and website is subject to our <a href="' + config.myIP + '/uploads/general-terms.html" style="' +
                                '         color: #0052E2;' +
                                '         text-decoration: none;' +
                                '         ">Terms of Use</a> and <a href="' + config.myIP + '/uploads/privacy-policy.html" style="' +
                                '         color: #0052E2;' +
                                '         text-decoration: none;' +
                                '         ">Privacy Statement</a>.</p>' +
                                '      <p style="' +
                                '         color: #8593A6;' +
                                '         font-family: Rubik, sans-serif;' +
                                '         font-weight: 400;' +
                                '         font-size: 12px;' +
                                '         margin: 20px 0 0 0;' +
                                '         ">© 2020  , LLC. All rights reserved</p>' +
                                '   </div >' +
                                '</body >' +
                                '</html > ';
                            var subject = 'Welcome to the Tryangle';
                            var toMail = savedUser.email;
                            /* Sending mail */
                            sendMail(toMail, subject, htmlText);
                        }
                        else {
                            var htmlText = '<!DOCTYPE html>' +
                                '<html>' +
                                '<head>' +
                                '  <title>Welcome to the Tryangle</title>' +
                                '  <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&amp;display=swap" rel="stylesheet">' +
                                '  <style type="text/css">' +
                                '     * {' +
                                '     box-sizing: border-box;' +
                                '     }' +
                                '  </style>' +
                                '</head>' +
                                '<body style="background-color: #dddddd;margin: 0;">' +
                                '   <div style="max-width: 680px;margin: 20px auto;background-color: #fff;padding: 40px 40px; width: 100%">' +
                                '     <div>' +
                                '      <img src="' + config.myIP + '/uploads/logo/LOGO.png">' +
                                '     </div>' +
                                // '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Well well ' + savedUser.first_name + ', Welcome to Tryangle - the Community Based Giving & Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.Ready to try it? Please <a href="tryangle://">click here</a> to verify your email.</p>' +
                                '<p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Well well ' + savedUser.first_name + ',<br/> Welcome to Tryangle - the Community Based Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.<br/>Ready to try it?</p>' +
                                '<span style="background-color: #9B51E0;' +
                                '                  text-decoration: none;' +
                                '                  display: inline-block;' +
                                '                  color: #fff;' +
                                '                  font-family: Rubik, sans-serif;' +
                                '                  font-size: 14px;' +
                                '                  padding: 8px 15px;' +
                                '                  border-radius: 10px;">' +
                                '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=" style="text-decoration: none;color:#fff">Get Started.</a>' +
                                '</span>' +
                                '     <div style="' +
                                '        display: flex;' +
                                '        align-items: self-start;' +
                                '        ">' +
                                '        <div style="' +
                                '           position: relative;' +
                                '           padding-top: 28px;' +
                                '           ">' +
                                '      <p style="' +
                                '         border-top: 1px solid #F0F3F7;' +
                                '         margin: 30px 0 0 0;' +
                                '         padding-top: 15px;' +
                                '         color: #8593A6;' +
                                '         font-family: Rubik, sans-serif;' +
                                '         font-weight: 400;' +
                                '         font-size: 12px;' +
                                '         ">This email was sent to you as a registered member of tryangle.co. To update your emails preferences <a href="#" style="' +
                                '         color: #0052E2;' +
                                '         text-decoration: none;' +
                                '         ">click here</a>. Use of the service and website is subject to our <a href="' + config.myIP + '/uploads/general-terms.html" style="' +
                                '         color: #0052E2;' +
                                '         text-decoration: none;' +
                                '         ">Terms of Use</a> and <a href="' + config.myIP + '/uploads/privacy-policy.html" style="' +
                                '         color: #0052E2;' +
                                '         text-decoration: none;' +
                                '         ">Privacy Statement</a>.</p>' +
                                '      <p style="' +
                                '         color: #8593A6;' +
                                '         font-family: Rubik, sans-serif;' +
                                '         font-weight: 400;' +
                                '         font-size: 12px;' +
                                '         margin: 20px 0 0 0;' +
                                '         ">© 2020  , LLC. All rights reserved</p>' +
                                '   </div >' +
                                '</body >' +
                                '</html > '
                            // var htmlText = 'Well well ' + savedUser.first_name + ', Welcome to Tryangle - the Community Based Giving & Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.Ready to try it? <p>Please <a href=" tryangle://">click here</a> to verify your email.</p>'
                            // var htmlText = '<h2>Hello ' + first_name + '</h2> <p>Please <a href="' + config.myIP + '/api/users/confirmemail/' + savedId + '">click here</a> to verify your email.</p><h5>Thanks</h5>'
                            var subject = 'Welcome to the Tryangle';
                            var toMail = savedUser.email;
                            /* Sending mail */
                            sendMail(toMail, subject, htmlText);
                        }
                        res.status(200).json({ data: userData, token: token });
                        // }
                    });
                }
            }

            else if (type == 'google') {
                var googletoken = req.body.token;
                if (googletoken === undefined || googletoken === null || googletoken === '') {
                    res.status(401).send({ status: false, message: 'Google token is required' });
                } else {
                    async function verify() {
                        const ticket = await client.verifyIdToken({
                            idToken: googletoken,
                            audience: config.client_id,
                        });
                        const payload = ticket.getPayload();
                        var email = payload['email'];
                        var checkEmail = await User.find({ email: email });
                        if (checkEmail.length > 0) {
                            emailExists = true;
                            return checkEmail;
                        } else {
                            const status = 1;
                            const profile_photo = payload['picture'];
                            const first_name = payload['given_name'];
                            const last_name = payload['family_name'];
                            const social_id = payload['sub'];
                            const paypal_id = req.body.paypal_id;
                            const saltRounds = 10;
                            const pwd = req.body.password;
                            const password = await bcrypt.hash(pwd, saltRounds);
                            return newUser = new User({ first_name, last_name, email, profile_photo, password, paypal_id, social_id, type, password, status, paypal_id });
                        }
                    }
                    var data = await verify((success) => {
                        return success;
                    }).catch((err) => {
                        googleError = true;
                    });
                }
            }

            else if (type === 'facebook') {
                var facebookError = false;
                var facebookToken = req.body.token;
                if (facebookToken === undefined || facebookToken === null || facebookToken === '') {
                    res.status(401).send({ status: false, message: 'facebook token required' });
                } else {

                    var dataa = await axios.get('https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=' + facebookToken)
                        .then(async (response) => {
                            facebookData = response.data;
                            var email = facebookData.email;
                            var checkEmail = await User.find({ email: email });
                            if (checkEmail.length > 0) {
                                emailExists = true;
                            } else {
                                var status = 1;
                                var first_name = facebookData.first_name;
                                var last_name = facebookData.last_name;
                                var social_id = facebookData.id;
                                var profile_photo = facebookData.picture.data.url;
                                const paypal_id = req.body.paypal_id;
                                const saltRounds = 10;
                                const pwd = req.body.password;
                                const password = await bcrypt.hash(pwd, saltRounds);

                                facebooknewuser = new User({ first_name, last_name, email, paypal_id, password, profile_photo, social_id, type, status, paypal_id });
                            }
                        })
                        .catch(error => {
                            facebookError = true;
                        });
                }
            }
        }

        if (googleError || facebookError) {
            res.status(404).send({ status: false, message: 'User not found' });
        }
        else {
            if (!emailExists) {
                /* save function to store data */
                if (type === 'facebook') {
                    savedUser = await facebooknewuser.save();
                    var savedId = savedUser._id;
                }
                else if (type === 'google' || type === 'email') {
                    savedUser = await newUser.save();
                    var savedId = savedUser._id;
                }

                /* Send Mail for verify mail */
                if (type === 'facebook' || type === 'google') {
                    var htmlText = '<!DOCTYPE html>' +
                        '<html>' +
                        '<head>' +
                        '  <title>Welcome to the Tryangle</title>' +
                        '  <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&amp;display=swap" rel="stylesheet">' +
                        '  <style type="text/css">' +
                        '     * {' +
                        '     box-sizing: border-box;' +
                        '     }' +
                        '  </style>' +
                        '</head>' +
                        '<body style="background-color: #dddddd;margin: 0;">' +
                        '   <div style="max-width: 680px;margin: 20px auto;background-color: #fff;padding: 40px 40px; width: 100%">' +
                        '     <div>' +
                        '      <img src="' + config.myIP + '/uploads/logo/LOGO.png">' +
                        '     </div>' +
                        // '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Well well ' + savedUser.first_name + ', Welcome to Tryangle - the Community Based Giving & Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.Ready to try it? Please <a href="tryangle://">click here</a> to verify your email.</p>' +
                        '<p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Well well ' + savedUser.first_name + ',<br/> Welcome to Tryangle - the Community Based Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.<br/>Ready to try it?</p>' +
                        '<span style="background-color: #9B51E0;' +
                        '                  text-decoration: none;' +
                        '                  display: inline-block;' +
                        '                  color: #fff;' +
                        '                  font-family: Rubik, sans-serif;' +
                        '                  font-size: 14px;' +
                        '                  padding: 8px 15px;' +
                        '                  border-radius: 10px;">' +
                        '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=" style="text-decoration: none;color:#fff">Get Started.</a>' +
                        '</span>' +
                        '     <div style="' +
                        '        display: flex;' +
                        '        align-items: self-start;' +
                        '        ">' +
                        '        <div style="' +
                        '           position: relative;' +
                        '           padding-top: 28px;' +
                        '           ">' +
                        '      <p style="' +
                        '         border-top: 1px solid #F0F3F7;' +
                        '         margin: 30px 0 0 0;' +
                        '         padding-top: 15px;' +
                        '         color: #8593A6;' +
                        '         font-family: Rubik, sans-serif;' +
                        '         font-weight: 400;' +
                        '         font-size: 12px;' +
                        '         ">This email was sent to you as a registered member of tryangle.co. To update your emails preferences <a href="#" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">click here</a>. Use of the service and website is subject to our <a href="' + config.myIP + '/uploads/general-terms.html" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">Terms of Use</a> and <a href="' + config.myIP + '/uploads/privacy-policy.html" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">Privacy Statement</a>.</p>' +
                        '      <p style="' +
                        '         color: #8593A6;' +
                        '         font-family: Rubik, sans-serif;' +
                        '         font-weight: 400;' +
                        '         font-size: 12px;' +
                        '         margin: 20px 0 0 0;' +
                        '         ">© 2020  , LLC. All rights reserved</p>' +
                        '   </div >' +
                        '</body >' +
                        '</html > '

                    var subject = 'Welcome to the Tryangle';
                    var toMail = savedUser.email;
                    /* Sending mail */
                    sendMail(toMail, subject, htmlText);
                }
                else if (type === 'email') {
                    var htmlText = '<!DOCTYPE html>' +
                        '<html>' +
                        '<head>' +
                        '  <title>Welcome to the Tryangle</title>' +
                        '  <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&amp;display=swap" rel="stylesheet">' +
                        '  <style type="text/css">' +
                        '     * {' +
                        '     box-sizing: border-box;' +
                        '     }' +
                        '  </style>' +
                        '</head>' +
                        '<body style="background-color: #dddddd;margin: 0;">' +
                        '   <div style="max-width: 680px;margin: 20px auto;background-color: #fff;padding: 40px 40px; width: 100%">' +
                        '     <div>' +
                        '        <img src="' + config.myIP + '/uploads/logo/LOGO.png">' +
                        '     </div>' +
                        // '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Well well ' + savedUser.first_name + ', Welcome to Tryangle - the Community Based Giving & Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.Ready to try it? Please <a href="' + config.myIP + '/api/users/confirmemail/' + savedId + '">click here</a> to verify your email</p>' +
                        '<p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Well well ' + savedUser.first_name + ',<br/> Welcome to Tryangle - the Community Based Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.<br/>Ready to try it?</p>' +
                        '<span style="background-color: #9B51E0;' +
                        '                  text-decoration: none;' +
                        '                  display: inline-block;' +
                        '                  color: #fff;' +
                        '                  font-family: Rubik, sans-serif;' +
                        '                  font-size: 14px;' +
                        '                  padding: 8px 15px;' +
                        '                  border-radius: 10px;">' +
                        '    <a href="' + config.myIP + '/api/users/confirmemail/' + savedId + '" style="text-decoration: none;color:#fff">verify your email</a>' +
                        '</span>' +
                        '     <div style="' +
                        '        display: flex;' +
                        '        align-items: self-start;' +
                        '        ">' +
                        '        <div style="' +
                        '           position: relative;' +
                        '           padding-top: 28px;' +
                        '           ">' +
                        '      <p style="' +
                        '         border-top: 1px solid #F0F3F7;' +
                        '         margin: 30px 0 0 0;' +
                        '         padding-top: 15px;' +
                        '         color: #8593A6;' +
                        '         font-family: Rubik, sans-serif;' +
                        '         font-weight: 400;' +
                        '         font-size: 12px;' +
                        '         ">This email was sent to you as a registered member of tryangle.co. To update your emails preferences <a href="#" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">click here</a>. Use of the service and website is subject to our <a href="' + config.myIP + '/uploads/general-terms.html" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">Terms of Use</a> and <a href="' + config.myIP + '/uploads/privacy-policy.html" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">Privacy Statement</a>.</p>' +
                        '      <p style="' +
                        '         color: #8593A6;' +
                        '         font-family: Rubik, sans-serif;' +
                        '         font-weight: 400;' +
                        '         font-size: 12px;' +
                        '         margin: 20px 0 0 0;' +
                        '         ">© 2020  , LLC. All rights reserved</p>' +
                        '   </div >' +
                        '</body >' +
                        '</html > '
                    // var htmlText = 'Well well ' + savedUser.first_name + ', Welcome to Tryangle - the Community Based Giving & Earning Platform. Thousands of teams around the world multiply their money, by just giving and inviting.Ready to try it? <p>Please <a href="' + config.myIP + '/api/users/confirmemail/' + savedId + '">click here</a> to verify your email.</p>'
                    // var htmlText = '<h2>Hello ' + first_name + '</h2> <p>Please <a href="' + config.myIP + '/api/users/confirmemail/' + savedId + '">click here</a> to verify your email.</p><h5>Thanks</h5>'
                    var subject = 'Welcome to the Tryangle';
                    var toMail = email;
                    /* Sending an email */
                    sendMail(toMail, subject, htmlText);
                }
            } else {
                if (type === 'facebook') {
                    var savedUser = await User.findOne({ email: facebookData.email });
                    var savedId = savedUser._id;
                }
                if (type === 'google') {
                    var savedUser = await User.findOne({ email: data[0].email });
                    var savedId = savedUser._id;
                }
                if (type === 'apple') {
                    var savedUser = await User.findOne({ email: checkEmail[0].email });
                    var savedId = savedUser._id;
                }
                if (type === 'email') {
                    res.status(400).send({ status: false, message: 'You are already registered.' });
                    return;
                }
            }

            if (type !== 'apple') {
                /* Create customer in stripe. */
                // const customer = await stripe.customers.create({
                //     email: savedUser.email,
                //     name: savedUser.first_name,
                //     description: 'New Customer',
                // });

                var walletUser = new UserWallet({
                    user_id: savedUser._id,
                    // customer_id: customer.id,
                    fund: 0,
                    earning_uptillNow: 0,
                    paypal_id: savedUser.paypal_id
                });
                await walletUser.save();

                /* Generate JWT token */
                const token = await jwt.sign({ _id: email }, process.env.TOKEN_SECRET);

                /* return json data */
                var userData = new Object();
                userData['_id'] = savedUser._id;
                userData['first_name'] = savedUser.first_name;
                userData['last_name'] = savedUser.last_name;
                userData['email'] = savedUser.email;
                userData['social_id'] = savedUser.social_id;
                userData['profile_photo'] = savedUser.profile_photo;
                userData['social_id'] = savedUser.social_id;
                userData['type'] = savedUser.type;
                userData['status'] = savedUser.status;
                userData['createdAt'] = savedUser.createdAt;
                userData['paypal_id'] = savedUser.paypal_id;
                res.status(200).json({ data: userData, token: token });

                /* Check the registering user's email is exists in invited table or not */
                var checkInvited = await InvitedUsers.find({ email: savedUser.email });

                if (checkInvited.length > 0) {
                    await InvitedUsers.updateMany({ email: savedUser.email },
                        {
                            $set: {
                                user_id: savedId
                            }
                        }
                    );
                }
            }
        }
    }
});

router.post('/login', async (req, res) => {
    const user = await User.find({ email: req.body.email.toLowerCase() })
    if (user.length === 0) {
        return res.status(400).send({ status: false, message: 'Invalid email Id' })
    }
    else {
        const token = jwt.sign({ _id: user[0].email }, process.env.TOKEN_SECRET);
        res.header('auth-token', token).send(token);
        res.send('Logged In');
    }
})

/* To log in user with email and password */
router.post('/login_with_email', async (req, res) => {
    const saltRounds = 10;
    console.log('req.body---->', req.body);
    var user_email = req.body.email.toLowerCase();
    var user_password = req.body.password;

    const user = await User.findOne({ email: user_email });

    if (user) {
        if (user.status === 1) {
            const passwordhash = user.password;

            var compare = await bcrypt.compare(user_password, passwordhash);
            if (compare) {
                const token = jwt.sign({ _id: user.email }, process.env.TOKEN_SECRET);
                var userDetails = new Object();
                userDetails._id = user._id;
                userDetails.first_name = user.first_name;
                userDetails.last_name = user.last_name;
                userDetails.email = user.email;
                userDetails.profile_photo = user.profile_photo;
                userDetails.paypal_id = user.paypal_id;
                userDetails.type = user.type;
                userDetails.status = user.status;
                userDetails.createdAt = user.createdAt;
                userDetails.updatedAt = user.updatedAt;

                return res.status(200).send({ data: userDetails, token: token })
            } else {
                return res.status(201).send('Invalid credentials')
            }
        }
        else {
            return res.status(201).send('Verify Email to login');
        }
    } else {
        if (!user) return res.status(201).send('Invalid credentials')
    }
})

/* To check if user is registred with social login or not */
router.post('/login_with_social', async (req, res, next) => {
    var errors = validationResult(req);
    if (errors.errors.length > 0) {
        return res.status(401).json({ status: false, errors: errors.array() })
    } else {
        /* get file and other fields */
        var type = req.body.type;

        if (type === undefined || type === null || type === '') {
            res.status(401).send({ status: false, message: 'type of register via google or email is required' })
        } else {
            if (type == 'google') {
                var googletoken = req.body.token;
                if (googletoken === undefined || googletoken === null || googletoken === '') {
                    res.status(401).send({ status: false, message: 'Google token is required' });
                } else {
                    async function verify() {
                        const ticket = await client.verifyIdToken({
                            idToken: googletoken,
                            audience: config.client_id,
                        });
                        const payload = ticket.getPayload();
                        var email = payload['email'];

                        var data = await User.find({ email: email });

                        if (data.length > 0) {
                            /* Send user data if registred */
                            const token = await jwt.sign({ _id: data[0].email }, process.env.TOKEN_SECRET);
                            res.status(200).send({ status: true, userinfo: data, token });
                        }
                        else {
                            /* Send fetched data if user not registred registred */
                            const profile_photo = payload['picture'];
                            const first_name = payload['given_name'];
                            const last_name = payload['family_name'];
                            let data = [];
                            data.push({
                                first_name: first_name,
                                last_name: last_name,
                                profile_photo: profile_photo,
                                email: email
                            })
                            res.status(404).send({ status: false, data: data });
                        }
                    }
                    var data = await verify((success) => {
                        return success;
                    }).catch((err) => {
                        res.status(404).send({ status: false, message: 'Invalid Token' });
                    });
                }
            }

            if (type === 'facebook') {
                var facebookError = false;
                var facebookToken = req.body.token;
                if (facebookToken === undefined || facebookToken === null || facebookToken === '') {
                    res.status(401).send({ status: false, message: 'facebook token required' });
                } else {
                    var dataa = await axios.get('https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=' + facebookToken)
                        .then(async (response) => {
                            facebookData = response.data;
                            var email = facebookData.email;
                            var data = await User.find({ email: email });
                            if (data.length > 0) {
                                /* Send user data if registred */
                                const token = await jwt.sign({ _id: data[0].email }, process.env.TOKEN_SECRET);
                                res.status(200).send({ status: true, userinfo: data, token });
                            }
                            else {
                                /* Send fetched data if user not registred registred */
                                var first_name = facebookData.first_name;
                                var last_name = facebookData.last_name;
                                var profile_photo = facebookData.picture.data.url;

                                let data = [];
                                data.push({
                                    first_name: first_name,
                                    last_name: last_name,
                                    profile_photo: profile_photo,
                                    email: email
                                })
                                res.status(404).send({ status: false, data: data });
                            }
                        })
                        .catch(error => {
                            res.status(404).send({ status: false, message: 'Invalid Token' });
                        });
                }
            }

            if (type == 'apple') {
                var appletoken = req.body.token;
                if (appletoken === undefined || appletoken === null || appletoken === '') {
                    res.status(401).send({ status: false, message: 'Apple token is required' });
                } else {
                    const json = jwt.decode(appletoken, { complete: true });
                    const kid = json.header.kid;

                    const client = jwksClient({
                        jwksUri: 'https://appleid.apple.com/auth/keys'
                    });

                    client.getSigningKey(kid, async (err, key) => {
                        if (err) {
                            return err;
                        }
                        const signingKey = key.rsaPublicKey;

                        if (!signingKey) {
                            res.status(200).send({ status: false, message: 'Something Went Wrong!' });
                        }
                        const applePayload = await verifyJWT(appletoken, signingKey);

                        if (!applePayload) {
                            res.status(200).send({ status: false, message: 'Something Went Wrong!' });
                        }
                        else {
                            // if (applePayload.sub == req.body.social_id) {
                            var data;
                            data = await User.find({ social_id: applePayload.sub });
                            if (data.length > 0) {
                                if (data[0].status == 0) {
                                    res.status(401).send({ status: false, message: 'Verify email to login', userinfo: data });
                                    /* Send user data if registred */
                                }
                                else {
                                    const token = await jwt.sign({ _id: data.email }, process.env.TOKEN_SECRET);
                                    res.status(200).send({ status: true, userinfo: data, token });
                                }
                            }
                            else {
                                /* Send fetched data if user not registred */
                                let data = [];
                                let is_private_email = null;
                                try {
                                    is_private_email = applePayload.is_private_email
                                }
                                catch (e) { }
                                data.push({
                                    email: applePayload.email,
                                    is_private_email: applePayload.is_private_email
                                })

                                res.status(404).send({ status: false, data: data });
                            }
                            // }
                        }
                    });
                }
            }
        }
    }
});

/* To reset user password */
router.post('/reset_password', config.vadidateEmail, async (req, res) => {
    const errors = validationResult(req);
    const email = req.body.email.toLowerCase();
    var data = { email: email };

    if (errors.errors.length > 0) {
        res.status(401).json({ status: false, errors: errors.array() })
    }
    else {
        User.findOne(data, async function (err, user) {
            if (err) {
                res.status(401).json({ status: false, errors: err });
            } else {
                if (user === null) {
                    res.status(401).json({ status: false, message: 'Your email did not found in our system' })
                } else {
                    const token = new TokenGenerator(256, TokenGenerator.BASE62).generate();
                    const resetPassword = new ResetPassword({
                        user_id: user._id,
                        email: user.email,
                        token: token
                    })
                    await resetPassword.save();

                    /* Send Email with unique token to reset user password */
                    var subject = 'Reset password request';
                    var toMail = user.email;
                    var htmlText = '<!DOCTYPE html>' +
                        '<html>' +
                        '<head>' +
                        '  <title>Reset password request</title>' +
                        '  <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&amp;display=swap" rel="stylesheet">' +
                        '  <style type="text/css">' +
                        '     * {' +
                        '     box-sizing: border-box;' +
                        '     }' +
                        '  </style>' +
                        '</head>' +
                        '<body style="background-color: #dddddd;margin: 0;">' +
                        '   <div style="max-width: 680px;margin: 20px auto;background-color: #fff;padding: 40px 40px; width: 100%">' +
                        '     <div>' +
                        '       <img src="' + config.myIP + '/uploads/logo/LOGO.png">' +
                        '     </div>' +
                        '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Hello ' + user.first_name + ', We received a request to reset your Tryangle password. If you didn’t request to reset your password, let us know by replying directly to this email. No changes were made to your account yet.</p>' +
                        '<span style="background-color: #9B51E0;' +
                        '                  text-decoration: none;' +
                        '                  display: inline-block;' +
                        '                  color: #fff;' +
                        '                  font-family: Rubik, sans-serif;' +
                        '                  font-size: 14px;' +
                        '                  padding: 8px 15px;' +
                        '                  border-radius: 10px;">' +
                        '    <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=password-reset/' + token + '" style="text-decoration: none;color:#fff">Reset Your Password</a>' +
                        '</span>' +
                        '     <div style="' +
                        '        display: flex;' +
                        '        align-items: self-start;' +
                        '        ">' +
                        '        <div style="' +
                        '           position: relative;' +
                        '           padding-top: 28px;' +
                        '           ">' +
                        '      <p style="' +
                        '         border-top: 1px solid #F0F3F7;' +
                        '         margin: 30px 0 0 0;' +
                        '         padding-top: 15px;' +
                        '         color: #8593A6;' +
                        '         font-family: Rubik, sans-serif;' +
                        '         font-weight: 400;' +
                        '         font-size: 12px;' +
                        '         ">This email was sent to you as a registered member of tryangle.co. To update your emails preferences <a href="#" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">click here</a>. Use of the service and website is subject to our <a href="' + config.myIP + '/uploads/general-terms.html" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">Terms of Use</a> and <a href="' + config.myIP + '/uploads/privacy-policy.html" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">Privacy Statement</a>.</p>' +
                        '      <p style="' +
                        '         color: #8593A6;' +
                        '         font-family: Rubik, sans-serif;' +
                        '         font-weight: 400;' +
                        '         font-size: 12px;' +
                        '         margin: 20px 0 0 0;' +
                        '         ">© 2020  , LLC. All rights reserved</p>' +
                        '   </div >' +
                        '</body >' +
                        '</html > '
                    // var htmlText = 'Hello ' + user.first_name + ', We received a request to reset your Tryangle password. <a href="tryangle://password-reset/' + token + '">[ Reset Your Password ]</a> If you didn’t request to reset your password, let us know by replying directly to this email. No changes were made to your account yet.';
                    // var htmlText = '<a href="tryangle://password-reset/' + token + '">click here</a> to reset your password.</p><h5>Thanks</h5>'
                    // var htmlText = '<h2>Hello ' + user.first_name + '</h2> <p>Please <a href="' + config.myIP + '/api/users/verify_and_reset_password/' + token + '">click here</a> to reset your password.</p><h5>Thanks</h5>'
                    sendMail(toMail, subject, htmlText);
                    user.isLinkAlive = true;
                    await user.save()
                        .then(() => res.status(200).json({ status: true, message: 'link has been sent to your registered email id to Reset password!!!' }))
                        .catch(err => res.status(401).json({ status: false, errors: err }))
                }
            }
        })
    }
})

/* Checks if received token is valid or not */
router.get('/verify_and_reset_password/:token', async (req, res) => {
    const token = req.params.token;
    const tokenExists = await ResetPassword.findOne({ token: token });
    if (tokenExists) {
        res.status(200).send({ status: true, message: 'OK', token: token })
    }
    else {
        res.status(401).send({ status: false, message: 'Invalid Token' })
    }
    return;
});

/* Reset user password in DB id token is valid */
router.post('/reset_verified_user_password', async (req, res) => {
    const token = req.body.token;
    var password = req.body.new_password;
    const userExists = await ResetPassword.findOne({ token: token });
    if (userExists) {
        User.findById({ _id: userExists.user_id }, {}).then(async (userDetails) => {
            if (userDetails.isLinkAlive === true) {
                User.findById(userExists.user_id)
                    .then(async (user) => {
                        const saltRounds = 10;
                        const pwd = password;
                        password = await bcrypt.hash(pwd, saltRounds);
                        user.password = password;
                        user.isLinkAlive = false;
                        user.save()
                            .then(() => res.status(200).json({ status: true, message: 'User password reseted!!!', data: user }))
                            .catch(err => res.status(401).json({ status: false, errors: err }));
                    })
                    .catch(err => res.status(401).json({ status: false, errors: err }));
                await ResetPassword.findOneAndRemove({ token: token });
            }
            else {
                res.status(401).json({ status: false, message: 'Link Expired' });
            }
        })
    }
    else {
        res.status(401).json({ status: false, message: 'Invalid Token' })
    }
})

/* To chnage user's password */
router.post('/update_password', async (req, res) => {
    var errors = validationResult(req);
    const id = req.body.id;

    var password = req.body.new_password;
    if (errors.errors.length > 0) {
        res.status(401).send({ status: false, errors: errors.errors[0] });
    } else {
        User.findById(id)
            .then(async (user) => {
                const saltRounds = 10;
                const pwd = password;
                password = await bcrypt.hash(pwd, saltRounds);
                user.password = password;

                /* Send email when user change their password */
                user.save()
                    .then(() => {
                        const subject = 'Tryangle Password Changed';
                        var htmlText = '<!DOCTYPE html>' +
                            '<html>' +
                            '<head>' +
                            '  <title>Tryangle Password Changed</title>' +
                            '  <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&amp;display=swap" rel="stylesheet">' +
                            '  <style type="text/css">' +
                            '     * {' +
                            '     box-sizing: border-box;' +
                            '     }' +
                            '  </style>' +
                            '</head>' +
                            '<body style="background-color: #dddddd;margin: 0;">' +
                            '   <div style="max-width: 680px;margin: 20px auto;background-color: #fff;padding: 40px 40px; width: 100%">' +
                            '     <div>' +
                            '       <img src="' + config.myIP + '/uploads/logo/LOGO.png">' +
                            '     </div>' +
                            '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">You have successfully updated your password. if it\'s not you then reset your password.</p>' +
                            '     <div style="' +
                            '        display: flex;' +
                            '        align-items: self-start;' +
                            '        ">' +
                            '        <div style="' +
                            '           position: relative;' +
                            '           padding-top: 28px;' +
                            '           ">' +
                            '      <p style="' +
                            '         border-top: 1px solid #F0F3F7;' +
                            '         margin: 30px 0 0 0;' +
                            '         padding-top: 15px;' +
                            '         color: #8593A6;' +
                            '         font-family: Rubik, sans-serif;' +
                            '         font-weight: 400;' +
                            '         font-size: 12px;' +
                            '         ">This email was sent to you as a registered member of tryangle.co. To update your emails preferences <a href="#" style="' +
                            '         color: #0052E2;' +
                            '         text-decoration: none;' +
                            '         ">click here</a>. Use of the service and website is subject to our <a href="' + config.myIP + '/uploads/general-terms.html" style="' +
                            '         color: #0052E2;' +
                            '         text-decoration: none;' +
                            '         ">Terms of Use</a> and <a href="' + config.myIP + '/uploads/privacy-policy.html" style="' +
                            '         color: #0052E2;' +
                            '         text-decoration: none;' +
                            '         ">Privacy Statement</a>.</p>' +
                            '      <p style="' +
                            '         color: #8593A6;' +
                            '         font-family: Rubik, sans-serif;' +
                            '         font-weight: 400;' +
                            '         font-size: 12px;' +
                            '         margin: 20px 0 0 0;' +
                            '         ">© 2020  , LLC. All rights reserved</p>' +
                            '   </div >' +
                            '</body >' +
                            '</html > '
                        // const htmlText = 'You have successfully updated your password. if it\'s not you then reset your password.';
                        const toMail = user.email;
                        sendMail(toMail, subject, htmlText);
                        res.status(200).json({ status: true, message: 'User password updated!!!', data: user })
                    })
                    .catch(err => res.status(401).json({ status: false, errors: err }))
            })
            .catch(err => res.status(401).json({ status: false, errors: err }))
    }
})

/* To display user earning uptil now and wallet balance */
router.post('/userEarning', verify, async function (req, res) {
    const user_id = req.body.user_id;
    let tryangle_details = [];
    let child_tryangle_details = [];
    let finalRes = [];

    const user_tryangle = await UserTrayangle.find({ user_id: user_id, is_tryangle_finished: true });
    const user_tryangle_id = u.pluck(user_tryangle, '_id');
    const user_plan_id = u.pluck(user_tryangle, 'plan_id');
    const plan_amount = await Plan.find({ _id: { $in: user_plan_id } });
    const child_tryangle = await UserTrayangle.find({ parent_tryangle_id: { $in: user_tryangle_id } });

    for (let i = 0; i < user_tryangle.length; i++) {
        for (let j = 0; j < plan_amount.length; j++) {
            if (user_tryangle[i].plan_id == plan_amount[j]._id) {
                for (let k = 0; k < child_tryangle.length; k++) {
                    if (user_tryangle[i]._id == child_tryangle[k].parent_tryangle_id) {
                        child_tryangle_details.push({
                            tryangle_id: child_tryangle[k]._id,
                            is_tryangle_finished: child_tryangle[k].is_tryangle_finished,
                            is_initial_tryangle: child_tryangle[k].is_initial_tryangle,
                            parent_tryangle_id: child_tryangle[k].parent_tryangle_id
                        })
                    }
                }
            }

            if (user_tryangle[i].plan_id == plan_amount[j]._id) {
                if (user_tryangle[i].is_closed == false) {
                    tryangle_details.push({
                        tryangle_id: user_tryangle[i]._id,
                        plan_id: user_tryangle[i].plan_id,
                        plan_amount: plan_amount[j].plan_amount,
                        is_tryangle_finished: user_tryangle[i].is_tryangle_finished,
                    })
                }
            }
        }
    }

    var newTryangle = [];
    var tryangle_detail = 0;
    tryangle_details.forEach(value => {
        newTryangle[tryangle_detail] = value;
        var data = [];
        child_tryangle_details.forEach(val => {
            if (value.tryangle_id == val.parent_tryangle_id) {
                data.push(val)
            }
        });
        newTryangle[tryangle_detail]['child_tryangles'] = data;
        tryangle_detail++;
    });

    for (let i = 0; i < newTryangle.length; i++) {
        var earning_child = 0;
        let actual_earning = 0;
        let able_to_earn = 0;
        var total_child = newTryangle[i].child_tryangles.length;
        able_to_earn = newTryangle[i].plan_amount + (newTryangle[i].plan_amount * (total_child - 2));

        for (let j = 0; j < newTryangle[i].child_tryangles.length; j++) {
            if (newTryangle[i].child_tryangles[j].is_tryangle_finished === true) {
                earning_child++;
            }
        }
        if (earning_child > 0) {
            actual_earning = newTryangle[i].plan_amount + (newTryangle[i].plan_amount * (earning_child - 2));
        }

        finalRes.push({
            tryangle_id: newTryangle[i].tryangle_id,
            plan_id: newTryangle[i].plan_id,
            plan_amount: newTryangle[i].plan_amount,
            is_tryangle_finished: newTryangle[i].is_tryangle_finished,
            able_to_earn: able_to_earn,
            actual_earning: actual_earning,
            child_tryangles: newTryangle[i].child_tryangles
        })
    }

    // res.send(finalRes);
    const userWallet = await UserWallet.findOne({ user_id: user_id });
    const userBalance = userWallet.fund;
    const userEarning = userWallet.earning_uptillNow;

    // for (let i = 0; i < finalRes.length; i++) {
    //     userTotalEarning += parseFloat(finalRes[i].actual_earning);
    // }
    res.status(200).send({ status: true, balance: userBalance, earning: userEarning })
    // res.status(200).send({ status: true, data: { Tryangle_details: finalRes } });
});

/* To check from given array if email is registred with our system or not. */
router.post('/check_registered', async (req, res) => {
    let emailArray = [];
    let userStatus = [];
    var exists = null;

    for (let i = 0; i < req.body.email.length; i++) {
        emailArray.push(req.body.email[i].toLowerCase());
    }
    await User.find({ email: { $in: emailArray } }).then(user => {
        user.forEach(data => {
            userStatus.push({ email: data.email, registered: true });
        })
    });

    emailArray.forEach(ele => {
        exists = userStatus.some(item => {
            return item.email === ele;
        });

        if (exists === false) {
            userStatus.push({ email: ele, registered: false });
        }
    });
    res.status(200).send({ status: true, data: userStatus });
})

/* Generates token to add fund in wallet using paypal braintree 
This token will be used at front end side to generate payment method such as apple pay, gpay, card or paypal.*/
router.post('/generate_fund_token', function (req, res) {
    const gateway = config.gateway
    //	Client token generated - Pass this token to front-end for generate source of payment like g-pay, a-pay
    gateway.clientToken.generate({}, (err, response) => {
        // pass clientToken to your front-end
        const clientToken = response.clientToken;
        res.send({ 'client_token': clientToken });
    });
});

/* To add fund in wallet */
router.post('/add_fund', verify, async (req, res) => {
    const nonceFromTheClient = req.body.payment_method_nonce;
    const deviceDataFromTheClient = req.body.deviceDataFromTheClient;
    const fund = req.body.fund;
    const user_id = req.body.user_id;
    const payment_type = req.body.type;
    const customer_detail = await User.findById({ _id: user_id });

    const gateway = config.gateway;
    /* Generates customer. */
    await gateway.customer.create({
        firstName: customer_detail.first_name,
        lastName: customer_detail.last_name,
        email: customer_detail.email,
    }, async (err, result) => {
        console.log('customer result -----> ', result);
        if (err) {
            res.send(err);
        }
        if (result.success) {
            /* If payment gets success response */
            await gateway.transaction.sale({
                amount: fund,
                paymentMethodNonce: nonceFromTheClient,
                deviceData: deviceDataFromTheClient,
                options: {
                    submitForSettlement: true
                }
            }, async (err, result) => {
                if (err) {
                    res.send(err);
                }

                if (result.success) {
                    let tax = 0;
                    if (payment_type == 'PayPal') {
                        /* Calculate tax if method is paypal otherwise it will not take tax */
                        tax = result.transaction.paypal.transactionFeeAmount;
                    }

                    var userPaymentData = new UserPayment({
                        user_id: user_id,
                        payment_id: result.transaction.id,
                        description: 'IntoWallet',
                        purchased_status: 'completed',
                        //payer_id: customer_id,
                        payer_email: customer_detail._id,
                        payer_first_name: customer_detail.first_name,
                        payer_last_name: customer_detail.last_name,
                        transaction_amount: fund,
                        transaction_tax: tax,
                        payment_method: payment_type,
                        payment_card: 'payment_card'
                    })
                    await userPaymentData.save();

                    var newFund;
                    const userExists = await UserWallet.findOne({ user_id: user_id });
                    if (userExists) {
                        newFund = parseFloat(userExists.fund) + (parseFloat(fund) - tax);
                        await UserWallet.findOneAndUpdate({ user_id: user_id }, { $set: { fund: newFund } });
                    }
                    else {
                        var newUserWallet = new UserWallet({ user_id: user_id, fund: fund })
                        await newUserWallet.save();
                    }
                    const data = {
                        user_id: user_id,
                        fund: fund,
                        newBalance: newFund
                    }
                    res.status(200).send({ status: true, message: 'payment successfull', data: data });
                } else {
                    /* Send Error message if payment does not get success response. */
                    res.status(401).send({ status: false, message: result.message });
                }
            });
        }
    });
});

router.post('/get_braintree_transaction_detail', verify, async (req, res) => {
    try {
        const { transaction_id } = req.body;
        config.gateway.transaction.find(transaction_id, (err, transaction) => {
            console.log(transaction);
            if (err) {
                res.status(200).json({
                    status: false,
                    message: 'Something went wrong!',
                    error: err
                })
            }
            else {

                res.status(200).json({
                    status: true,
                    data: transaction
                })
            }
        });
    }
    catch (err) {
        res.status(400).json({
            status: false,
            message: 'Something went wrong!',
            error: err.message
        })
    }
})

/* Display user's transaction untill now such as IntoWallet, Purchase, Earning & Cashout */
router.post('/user_transaction', verify, async (req, res) => {
    const user_id = req.body.user_id;
    const userTransactionHistory = [];
    const user_transaction = await UserPayment.find({ user_id: user_id });
    let earning_transaction = [];
    let earning_tryangle_transaction = [];
    let purchase = [];
    let userDetail = null;

    try {
        userDetail = await User.findById({ _id: user_id });
    }
    catch (err) { }

    if (userDetail) {
        user_transaction.forEach(async (ele) => {
            if (ele.description === 'IntoWallet') {
                userTransactionHistory.push({
                    transaction_id: ele._id,
                    user_id: user_id,
                    payment_id: ele.payment_id,
                    description: ele.description,
                    purchased_status: ele.purchased_status,
                    payer_email: ele.payer_email,
                    payer_first_name: ele.payer_first_name,
                    payer_last_name: ele.payer_last_name,
                    transaction_amount: ele.transaction_amount,
                    transaction_tax: ele.transaction_tax,
                    payment_method: ele.payment_method,
                    purchase_dateTime: ele.createdAt
                });
            }
            if (ele.description === 'Earning') {
                earning_tryangle_transaction.push(ele);
                earning_transaction.push(ele.tryangle_id);
            }
            if (ele.description == 'Purchase') {
                purchase.push(ele);
            }
            if (ele.description === 'Cashout') {
                userTransactionHistory.push({
                    transaction_id: ele._id,
                    user_id: user_id,
                    payment_id: ele.payment_id,
                    description: ele.description,
                    payer_email: ele.payer_email,
                    payer_first_name: ele.payer_first_name,
                    payer_last_name: ele.payer_last_name,
                    transaction_amount: ele.transaction_amount,
                    transaction_tax: ele.transaction_tax,
                    purchase_dateTime: ele.createdAt
                });
            }
        });

        /* To display Purchase transaction */
        const purchase_tryangle_ids = u.pluck(purchase, 'tryangle_id');
        const hasParent = await UserTrayangle.find({ _id: { $in: purchase_tryangle_ids } });
        const parentTryangleIDs = u.pluck(hasParent, 'parent_tryangle_id');
        let parentTryangleID = [];
        parentTryangleIDs.forEach(ele => {
            if (ele !== '') {
                parentTryangleID.push(ele);
            }
        });

        const parentTryangleInfo = await UserTrayangle.find({ _id: { $in: parentTryangleID } });
        const parentUserID = u.pluck(parentTryangleInfo, 'user_id');
        const parent_user_info = await User.find({ _id: { $in: parentUserID } });

        /* If not invited by anyone || buys plan by themselves and start a tryangle */
        for (let i = 0; i < purchase.length; i++) {
            for (let j = 0; j < hasParent.length; j++) {
                if (purchase[i].tryangle_id == hasParent[j]._id) {
                    if (hasParent[j].parent_tryangle_id == '' || hasParent[j].parent_tryangle_id == null || hasParent[j].parent_tryangle_id == undefined) {
                        userTransactionHistory.push({
                            transaction_id: purchase[i]._id,
                            user_id: user_id,
                            description: 'Purchase',
                            payer_email: purchase[i].payer_email,
                            payer_first_name: purchase[i].payer_first_name,
                            payer_last_name: purchase[i].payer_last_name,
                            transaction_amount: purchase[i].transaction_amount,
                            trayngle_id: purchase[i].tryangle_id,
                            purchase_dateTime: purchase[i].createdAt,
                        });
                    }
                    else {
                        /* Get parent details if soeone as invited them  */
                        for (let k = 0; k < parentTryangleInfo.length; k++) {
                            if (hasParent[j].parent_tryangle_id == parentTryangleInfo[k]._id) {
                                for (let l = 0; l < parent_user_info.length; l++) {
                                    if (parentTryangleInfo[k].user_id == parent_user_info[l]._id) {
                                        let parent = {
                                            user_id: parent_user_info[l]._id,
                                            first_name: parent_user_info[l].first_name,
                                            last_name: parent_user_info[l].last_name,
                                            email: parent_user_info[l].email,
                                            profile_photo: parent_user_info[l].profile_photo,
                                        }
                                        userTransactionHistory.push({
                                            transaction_id: purchase[i]._id,
                                            user_id: user_id,
                                            description: 'Purchase',
                                            payer_email: purchase[i].payer_email,
                                            payer_first_name: purchase[i].payer_first_name,
                                            payer_last_name: purchase[i].payer_last_name,
                                            transaction_amount: purchase[i].transaction_amount,
                                            trayngle_id: purchase[i].tryangle_id,
                                            purchase_dateTime: purchase[i].createdAt,
                                            parent_userInfo: parent
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        /* To display Earning transaction */
        const invitationInfo = await InvitedUsers.find({ tryangle_id: { $in: earning_transaction } });
        const tryangleDetail = await UserTrayangle.find({ _id: { $in: earning_transaction } });

        let planAmount = 0;
        let earning_amount = 0;
        let parent_user_ids = [];

        for (let i = 0; i < earning_transaction.length; i++) {
            let total_invite = 0;
            let successful_invite = 0;
            let purchase_date = '';

            for (let j = 0; j < invitationInfo.length; j++) {
                if (earning_transaction[i] == invitationInfo[j].tryangle_id) {
                    parent_user_ids.push(invitationInfo[j].parent_id)
                    total_invite += 1;
                    if (invitationInfo[j].accepted_status == 1) {
                        successful_invite += 1;
                    }
                }
                for (let l = 0; l < tryangleDetail.length; l++) {
                    if (tryangleDetail[l]._id == invitationInfo[j].tryangle_id) {
                        purchase_date = tryangleDetail[l].tryangle_creation_datetime
                    }
                }
            }

            let parentTryan = [];

            for (let j = 0; j < tryangleDetail.length; j++) {
                if (earning_tryangle_transaction[i].tryangle_id == tryangleDetail[j]._id) {
                    parentTryan.push({
                        transaction_id: earning_tryangle_transaction[i]._id,
                        tryangle_id: earning_tryangle_transaction[i].tryangle_id,
                        parent_tryangle_id: tryangleDetail[j].parent_tryangle_id
                    })
                }
            }

            let parentInfo = [];
            let parent_Tryangle_ID = [];
            let parent_Tryangle = [];
            let parentUser = [];
            let parentUserInfo = [];
            try {
                parent_Tryangle_ID = u.pluck(parentTryan, 'parent_tryangle_id');
                parent_Tryangle = await UserTrayangle.find({ _id: { $in: parent_Tryangle_ID } });
                parentUser = u.pluck(parent_Tryangle, 'user_id');
                parentUserInfo = await User.find({ _id: { $in: parentUser } });
            }
            catch (err) { }


            for (let j = 0; j < parentTryan.length; j++) {
                if (parentTryan[j].transaction_id == earning_tryangle_transaction[i]._id) {
                    for (let k = 0; k < parent_Tryangle.length; k++) {
                        if (parentTryan[j].parent_tryangle_id == parent_Tryangle[k]._id) {
                            for (let l = 0; l < parentUserInfo.length; l++) {
                                if (parent_Tryangle[k].user_id == parentUserInfo[l]._id) {
                                    parentInfo = {
                                        user_id: parentUserInfo[l]._id,
                                        email: parentUserInfo[l].email,
                                        first_name: parentUserInfo[l].first_name,
                                        last_name: parentUserInfo[l].last_name,
                                        profile_photo: parentUserInfo[l].profile_photo,
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (successful_invite >= 2) {
                earning_amount = parseFloat(planAmount) + (parseFloat(planAmount) * (successful_invite - 2))
            }
            else {
                earning_amount = 0
            }

            userTransactionHistory.push({
                transaction_id: earning_tryangle_transaction[i]._id,
                user_id: user_id,
                description: 'Earning',
                payer_email: userDetail.email,
                payer_first_name: userDetail.first_name,
                payer_last_name: userDetail.last_name,
                transaction_amount: earning_tryangle_transaction[i].transaction_amount,
                maintanance_fee: earning_tryangle_transaction[i].transaction_tax,
                purchase_dateTime: earning_tryangle_transaction[i].createdAt,
                total_invite: total_invite,
                successful_invite: successful_invite,
                plan_amount: planAmount,
                tryangle_id: earning_tryangle_transaction[i].tryangle_id,
                invitedy: parentInfo
            });
        }
        res.status(200).send({ status: true, data: userTransactionHistory })
    }
    else {
        res.status(401).send({ status: false, message: 'User does not exists' })
    }

})

/* To get single transaction detail from transaction id */
router.post('/single_transaction_detail', verify, async (req, res) => {
    const transaction_id = req.body.transaction_id;
    let parentTryangle = null;
    let parentUserInfo = null;
    let singleTransaction = null;
    let userTryangle = null;

    const transactionDetail = await UserPayment.findById({ _id: transaction_id });
    const userID = transactionDetail.user_id;
    if (transactionDetail) {
        if (transactionDetail.description === 'Purchase' || transactionDetail.description === 'Earning') {
            userTryangle = await UserTrayangle.findById({ _id: transactionDetail.tryangle_id });
            if (userTryangle.parent_tryangle_id !== '' && userTryangle.parent_tryangle_id !== null && userTryangle.parent_tryangle_id !== undefined) {
                parentTryangle = await UserTrayangle.findById({ _id: userTryangle.parent_tryangle_id });
                parentUserInfo = await User.findById({ _id: parentTryangle.user_id }, { first_name: 1, last_name: 1, email: 1, profile_photo: 1 });
            }

            if (transactionDetail.description === 'Purchase') {
                singleTransaction = {
                    _id: transactionDetail._id,
                    user_id: transactionDetail.user_id,
                    description: transactionDetail.description,
                    payer_email: transactionDetail.payer_email,
                    payer_first_name: transactionDetail.payer_first_name,
                    payer_last_name: transactionDetail.payer_last_name,
                    transaction_amount: transactionDetail.transaction_amount,
                    tryangle_id: transactionDetail.tryangle_id,
                    purchase_dateTime: transactionDetail.createdAt,
                    parentUserInfo: parentUserInfo
                }
            }
            else if (transactionDetail.description === 'Earning') {
                const total_invite = await InvitedUsers.find({ tryangle_id: userTryangle._id }).countDocuments();
                const successfull_invite = await InvitedUsers.find({ tryangle_id: userTryangle._id }, { accepted_status: 1 }).countDocuments();

                const total_amount = parseFloat(transactionDetail.transaction_tax) + parseFloat(transactionDetail.transaction_amount);
                const percen = total_amount / parseFloat(transactionDetail.transaction_tax);

                const planDetail = await Plan.findById({ _id: userTryangle.plan_id });
                singleTransaction = {
                    _id: transactionDetail._id,
                    user_id: transactionDetail.user_id,
                    description: transactionDetail.description,
                    payer_email: transactionDetail.payer_email,
                    payer_first_name: transactionDetail.payer_first_name,
                    payer_last_name: transactionDetail.payer_last_name,
                    total_amount: total_amount,
                    transaction_amount: transactionDetail.transaction_amount,
                    maintanance_fee: transactionDetail.transaction_tax,
                    maintanance_percentage: percen,
                    tryangle_id: transactionDetail.tryangle_id,
                    purchase_dateTime: transactionDetail.createdAt,
                    tryangle_creation_datetime: userTryangle.tryangle_creation_datetime,
                    plan_amount: planDetail.plan_amount,
                    total_invite: total_invite,
                    successfull_invite: successfull_invite,
                    parentUserInfo: parentUserInfo
                }
            }
        }
        else {
            /* If transaction description is IntoWallet or Cashout it will send it as it is */
            singleTransaction = transactionDetail;
        }
        res.status(200).send({ status: true, userID: userID, data: singleTransaction })
    }
    else {
        res.status(404).send({ status: false, message: 'No data found' })
    }
})

/* To payout user's fund into their paypal_id */
router.post('/user_cashout', verify, async (req, res) => {
    const user_id = req.body.user_id;
    const cashoutFund = req.body.fund;

    const userDetail = await User.findById({ _id: user_id });
    const userWalletDetail = await UserWallet.findOne({ user_id: user_id });
    let paypal_id = userDetail.paypal_id;
    if (paypal_id === null || paypal_id == '' || paypal_id === undefined)
        paypal_id = userWalletDetail.paypal_id;

    // Creating an environment
    let clientId = process.env.PAYPAL_CLIENT_ID;
    let clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    let environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
    let client = new paypal.core.PayPalHttpClient(environment);
    let accessToken = null;
    let tokenType = null;
    let senderBatchId = "Test_sdk_" + Math.random().toString(36).substring(7);

    if (parseFloat(cashoutFund) < parseFloat(userWalletDetail.fund)) {
        // if (parseFloat(userWalletDetail.fund) > 0) {
        try {
            const { data: { access_token, token_type } } = await axios({
                url: 'https://api.sandbox.paypal.com/v1/oauth2/token',
                method: 'post',
                headers: {
                    Accept: 'application/json',
                    'Accept-Language': 'en_US',
                    'content-type': 'application/x-www-form-urlencoded',
                },
                auth: {
                    username: clientId,
                    password: clientSecret,
                },
                params: {
                    grant_type: 'client_credentials',
                },
            });
            accessToken = access_token;
            tokenType = token_type;
        }
        catch (error) {
            return res.status(400).send({
                status: 'error',
                message: "Error in paypal"
            });
        }

        let requestBody = {
            "sender_batch_header": {
                "recipient_type": "EMAIL",
                "email_message": "SDK payouts test txn",

                "note": "Enjoy your Payout!!",
                "sender_batch_id": senderBatchId,
                "email_subject": "This is a test transaction from SDK"
            },
            "items": [{
                "note": "Your " + cashoutFund + "$ Payout!",
                "amount": {
                    "currency": "USD",
                    "value": cashoutFund
                    // "value": userWalletDetail.fund
                },
                "receiver": paypal_id,
            }]
        }

        var sync_mode = 'true';
        try {
            let request = new paypal.payouts.PayoutsPostRequest(sync_mode);
            request.requestBody(requestBody);
            let response = await client.execute(request);

            const responseResult = await axios({
                url: response.result.links[0].href,
                method: 'get',
                headers: {
                    Authorization: tokenType + ' ' + accessToken
                }
            });
            try {
                if (responseResult.data.batch_header.payout_batch_id) {
                    // await UserWallet.findOneAndUpdate({ user_id: user_id }, { $set: { fund: 0 } })

                    let userPaymentDetail = new UserPayment({
                        user_id: user_id,
                        description: 'Cashout',
                        payment_id: responseResult.data.batch_header.payout_batch_id,
                        payer_email: paypal_id,
                        purchased_status: 'Completed',
                        payer_first_name: userDetail.first_name,
                        payer_last_name: userDetail.last_name,
                        transaction_amount: cashoutFund,
                        // transaction_amount: userWalletDetail.fund,
                        transaction_amount_currency: responseResult.data.batch_header.amount.currency,
                        transaction_tax: responseResult.data.batch_header.fees.value
                    })
                    const transaction = await userPaymentDetail.save();

                    const newFund = parseFloat(userWalletDetail.fund) - parseFloat(cashoutFund)
                    await UserWallet.findOneAndUpdate({ user_id: user_id }, { $set: { fund: newFund } })

                    const notificationData = await PushNotification.find({ user_id: user_id }, { registrationToken: 1, platform: 1 });

                    notificationData.forEach(ele => {
                        if (ele.platform == 'android') {
                            var payload = {
                                notification: {
                                    title: "Tryangle Cashout",
                                    body: "You have cashout you money."
                                }
                            };
                            sendNotification(ele.registrationToken, payload)
                        }
                        else if (ele.platform == 'ios') {
                            let notification = new apn.Notification({
                                alert: {
                                    title: "Tryangle Cashout",
                                    body: "You have cashout you money."
                                },
                                topic: 'com. .tryangle',
                                payload: {
                                    "sender": "node-apn",
                                },
                                pushType: 'background'
                            });

                            apnProvider.send(notification, ele.registrationToken);
                        }
                    })

                    var subject = 'Tryangle Cashout';
                    var htmlText = '<!DOCTYPE html>' +
                        '<html>' +
                        '<head>' +
                        '  <title>Tryangle Cashout</title>' +
                        '  <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&amp;display=swap" rel="stylesheet">' +
                        '  <style type="text/css">' +
                        '     * {' +
                        '     box-sizing: border-box;' +
                        '     }' +
                        '  </style>' +
                        '</head>' +
                        '<body style="background-color: #dddddd;margin: 0;">' +
                        '   <div style="max-width: 680px;margin: 20px auto;background-color: #fff;padding: 40px 40px; width: 100%">' +
                        '     <div>' +
                        '        <img src="' + config.myIP + '/uploads/logo/LOGO.png">' +
                        '     </div>' +
                        // '     <div>' +
                        // '        <svg width="130" height="19" viewBox="0 0 147 21" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                        // '           <path d="M113.534 17.848C111.507 19.3998 108.773 20.5588 105.447 20.5588C99.3831 20.5588 94.8491 16.3864 94.8491 10.4895V10.4338C94.8491 4.75939 99.2997 0.308838 105.336 0.308838C108.341 0.308838 110.573 1.12417 112.467 2.52869C112.906 2.85452 112.953 3.48234 112.601 3.90089L110.234 6.71497C109.879 7.13746 109.255 7.18069 108.794 6.87727C107.788 6.21601 106.895 6.04852 105.364 6.04852C103.039 6.04852 100.786 7.51316 100.786 10.4895V10.5451C100.786 13.249 102.571 15.3814 105.447 15.3814C106.595 15.3814 107.515 15.3183 108.269 14.9448C108.465 14.8478 108.573 14.6394 108.573 14.4208C108.573 14.0629 108.282 13.7728 107.924 13.7728H105.946C105.394 13.7728 104.946 13.3251 104.946 12.7728V9.7927C104.946 9.24041 105.394 8.7927 105.946 8.7927H112.903C113.455 8.7927 113.903 9.24041 113.903 9.7927V17.0831C113.903 17.3817 113.771 17.6665 113.534 17.848Z" fill="#070417"></path>' +
                        // '           <path d="M4.62646 19.0447C4.62646 19.597 5.07418 20.0447 5.62646 20.0447H10.561C11.1133 20.0447 11.561 19.597 11.561 19.0447V8.05884C11.561 7.50655 12.0087 7.05884 12.561 7.05884H14.4238C14.9761 7.05884 15.4238 6.61112 15.4238 6.05884V1.7439C15.4238 1.19161 14.9761 0.743896 14.4238 0.743896H1.76367C1.21139 0.743896 0.763672 1.19161 0.763672 1.7439V6.05884C0.763672 6.61112 1.21139 7.05884 1.76367 7.05884H3.62646C4.17875 7.05884 4.62646 7.50655 4.62646 8.05884V19.0447Z" fill="#070417"></path>' +
                        // '           <path fill-rule="evenodd" clip-rule="evenodd" d="M17.665 19.0447C17.665 19.597 18.1128 20.0447 18.665 20.0447H23.4678C24.0201 20.0447 24.4678 19.597 24.4678 19.0447V17.6991C24.4678 16.6566 25.8632 16.3097 26.3513 17.2308L27.561 19.513C27.7344 19.8401 28.0743 20.0447 28.4445 20.0447H33.7691C34.5644 20.0447 35.0415 19.1612 34.6052 18.4961L31.355 13.542C30.947 12.92 31.3536 12.067 31.9986 11.6963C32.4536 11.4349 32.8525 11.0755 33.1953 10.6184C33.8633 9.7395 34.1973 8.6145 34.1973 7.24341C34.1973 5.15161 33.5293 3.54321 32.1934 2.41821C30.8662 1.302 28.9326 0.743896 26.3926 0.743896H18.665C18.1128 0.743896 17.665 1.19161 17.665 1.7439V19.0447ZM24.4678 6.71411C24.4678 6.16183 24.9155 5.71411 25.4678 5.71411H25.5488C26.2256 5.71411 26.7397 5.87231 27.0913 6.18872C27.4341 6.53149 27.6055 7.0105 27.6055 7.62573C27.6055 8.23218 27.4341 8.68921 27.0913 8.99683C26.7397 9.32202 26.2256 9.48462 25.5488 9.48462H25.4678C24.9155 9.48462 24.4678 9.0369 24.4678 8.48462V6.71411Z" fill="#070417"></path>' +
                        // '           <path d="M41.1299 20.0447C40.5776 20.0447 40.1299 19.597 40.1299 19.0447V11.7918C40.1299 11.6106 40.0807 11.4328 39.9875 11.2774L34.5782 2.25824C34.1784 1.59171 34.6585 0.743896 35.4357 0.743896H40.9234C41.3221 0.743896 41.6826 0.980664 41.8411 1.34647L43.2017 4.48804C43.4258 5.03989 43.5951 5.51983 43.7093 5.92787C43.7137 5.94356 43.7197 5.95866 43.7262 5.97358C43.7357 5.99513 43.7409 6.0125 43.742 6.02569C43.7422 6.02886 43.7429 6.032 43.7444 6.03485C43.7528 6.05173 43.7778 6.04925 43.783 6.0311C43.8598 5.76224 44.0176 5.33138 44.2563 4.73853C44.2915 4.66821 44.3135 4.61548 44.3223 4.58032C44.3398 4.53638 44.353 4.50562 44.3618 4.48804L45.698 1.35193C45.8551 0.983204 46.2172 0.743896 46.618 0.743896H52.0151C52.7995 0.743896 53.2785 1.6058 52.8643 2.27193L47.268 11.2724C47.1694 11.4309 47.1172 11.6138 47.1172 11.8004V19.0447C47.1172 19.597 46.6695 20.0447 46.1172 20.0447H41.1299Z" fill="#070417"></path>' +
                        // '           <path d="M72.7197 19.0447C72.7197 19.597 73.1674 20.0447 73.7197 20.0447H78.417C78.9693 20.0447 79.417 19.597 79.417 19.0447V13.0837C79.417 12.6531 79.3994 12.095 79.3643 11.4094C79.3494 11.1322 79.775 10.986 79.9164 11.2249L84.8482 19.5542C85.0283 19.8582 85.3554 20.0447 85.7087 20.0447H90.9941C91.5464 20.0447 91.9941 19.597 91.9941 19.0447V1.7439C91.9941 1.19161 91.5464 0.743896 90.9941 0.743896H86.3101C85.7578 0.743896 85.3101 1.19161 85.3101 1.7439V7.21704C85.3101 7.92017 85.3276 8.63208 85.3628 9.35278C85.3782 9.66137 84.9133 9.8194 84.7555 9.55375L79.8131 1.2332C79.6329 0.929842 79.3062 0.743896 78.9533 0.743896H73.7197C73.1674 0.743896 72.7197 1.19161 72.7197 1.7439V19.0447Z" fill="#070417"></path>' +
                        // '           <path d="M119.071 20.0447C118.519 20.0447 118.071 19.597 118.071 19.0447V1.7439C118.071 1.19161 118.519 0.743896 119.071 0.743896H124.019C124.571 0.743896 125.019 1.19161 125.019 1.7439V12.7825C125.019 13.3348 125.467 13.7825 126.019 13.7825H130.769C131.321 13.7825 131.769 14.2302 131.769 14.7825V19.0447C131.769 19.597 131.321 20.0447 130.769 20.0447H119.071Z" fill="#070417"></path>' +
                        // '           <path d="M133.892 19.0447C133.892 19.597 134.339 20.0447 134.892 20.0447H145.957C146.509 20.0447 146.957 19.597 146.957 19.0447V15.8108C146.957 15.2585 146.509 14.8108 145.957 14.8108H141.694C141.142 14.8108 140.694 14.3631 140.694 13.8108V13.7805C140.694 13.2282 141.142 12.7805 141.694 12.7805H145.231C145.784 12.7805 146.231 12.3328 146.231 11.7805V8.83667C146.231 8.28439 145.784 7.83667 145.231 7.83667H141.624C141.11 7.83667 140.694 7.42054 140.694 6.90723C140.694 6.39391 141.11 5.97778 141.624 5.97778H145.798C146.351 5.97778 146.798 5.53007 146.798 4.97778V1.7439C146.798 1.19161 146.351 0.743896 145.798 0.743896H134.892C134.339 0.743896 133.892 1.19161 133.892 1.7439V19.0447Z" fill="#070417"></path>' +
                        // '           <path d="M59.4821 1.78036C59.8576 1.07061 60.8743 1.07061 61.2498 1.78036L64.8684 8.61917C65.2208 9.28516 64.738 10.0869 63.9845 10.0869H56.7474C55.9939 10.0869 55.5111 9.28516 55.8635 8.61917L59.4821 1.78036Z" fill="#070417"></path>' +
                        // '           <path d="M54.2028 11.7381C54.5783 11.0284 55.595 11.0284 55.9705 11.7381L59.5891 18.5769C59.9415 19.2429 59.4587 20.0446 58.7052 20.0446H51.4681C50.7146 20.0446 50.2318 19.2429 50.5842 18.5769L54.2028 11.7381Z" fill="#9B51E0"></path>' +
                        // '           <path d="M64.7609 11.7381C65.1364 11.0284 66.1531 11.0284 66.5286 11.7381L70.1472 18.5769C70.4996 19.2429 70.0168 20.0446 69.2633 20.0446H62.0262C61.2727 20.0446 60.7899 19.2429 61.1423 18.5769L64.7609 11.7381Z" fill="#070417"></path>' +
                        // '        </svg>' +
                        // '     </div>' +

                        '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Howdy ' + userDetail.first_name + ', You have cashed $' + cashoutFund + ' out of your Tryangle Wallet. Enjoy! Click below to see your wallet balance. </p>' +
                        // '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Howdy ' + userDetail.first_name + ', You have cashed $' + userWalletDetail.fund + ' out of your Tryangle Wallet. Enjoy! Click below to see your wallet balance. </p>' +
                        '<span style="background-color: #9B51E0;' +
                        '                  text-decoration: none;' +
                        '                  display: inline-block;' +
                        '                  color: #fff;' +
                        '                  font-family: Rubik, sans-serif;' +
                        '                  font-size: 14px;' +
                        '                  padding: 8px 15px;' +
                        '                  border-radius: 10px;">' +
                        '    <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=wallet/ ' + transaction._id + '" style="text-decoration: none;color:#fff">MY WALLET</a>' +
                        '</span>' +

                        '     <div style="' +
                        '        display: flex;' +
                        '        align-items: self-start;' +
                        '        ">' +
                        '        <div style="' +
                        '           position: relative;' +
                        '           padding-top: 28px;' +
                        '           ">' +
                        '      <p style="' +
                        '         border-top: 1px solid #F0F3F7;' +
                        '         margin: 30px 0 0 0;' +
                        '         padding-top: 15px;' +
                        '         color: #8593A6;' +
                        '         font-family: Rubik, sans-serif;' +
                        '         font-weight: 400;' +
                        '         font-size: 12px;' +
                        '         ">This email was sent to you as a registered member of tryangle.co. To update your emails preferences <a href="#" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">click here</a>. Use of the service and website is subject to our <a href="' + config.myIP + '/uploads/general-terms.html" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">Terms of Use</a> and <a href="' + config.myIP + '/uploads/privacy-policy.html" style="' +
                        '         color: #0052E2;' +
                        '         text-decoration: none;' +
                        '         ">Privacy Statement</a>.</p>' +
                        '      <p style="' +
                        '         color: #8593A6;' +
                        '         font-family: Rubik, sans-serif;' +
                        '         font-weight: 400;' +
                        '         font-size: 12px;' +
                        '         margin: 20px 0 0 0;' +
                        '         ">© 2020  , LLC. All rights rese/p>' +
                        '   </div >' +
                        '</body >' +
                        '</html > '
                    // var htmlText = 'Howdy ' + userDetail.first_name + ', You have cashed $' + userWalletDetail.fund + ' out of your Tryangle Wallet. Enjoy! Click below to see your wallet balance. <a href="tryangle://wallet/: ' + transaction._id + '">[ MY WALLET ]</a>';
                    // var htmlText = 'You have cashout you money.';
                    var toMail = userDetail.email;
                    sendMail(toMail, subject, htmlText);
                    res.status(200).send({ status: true, message: 'OK', cashout_fund: responseResult.data.batch_header.amount.value });;
                }
                else {
                    res.status(400).send({ status: false, message: 'something went wrong in payment', error: err })
                }
            }
            catch (err) {
                res.status(400).send({ status: false, message: err.message })
            }
        }
        catch (err) {
            res.status(400).send({ status: false, message: 'Something went wrong. Please try again later.' });;
        }
    }
    else {
        res.status(401).send({ status: false, message: 'you do not have enough balance in wallet' });
    }
});

/* Adds notification data such as UDID, registration token & platform */
router.post('/add_NotificationInfo', verify, async (req, res) => {
    const user_id = req.body.user_id;
    const registrationToken = req.body.registrationToken;
    const udid = req.body.udid;
    const platform = req.body.platform;
    let exists = false;
    try {
        const data = await PushNotification.findOneAndUpdate({ registrationToken: registrationToken }, { $set: { user_id: user_id } })

        if (data) {
            exists = true;
        }

        if (exists === false) {
            let userNotiData = new PushNotification({
                user_id: user_id,
                udid: udid,
                registrationToken: registrationToken,
                platform: platform
            });
            const a = await userNotiData.save();

        }
        res.status(200).send({ status: true, message: 'OK' });
    }
    catch (err) {
        res.status(401).send({ status: false, message: 'Something wrong went to save notification data.' });
    }
});

/* Remove user id from Notification table when user logs out. */
router.post('/logout', verify, async (req, res) => {
    const user_id = req.body.user_id;
    await PushNotification.updateMany({ user_id: user_id }, { $set: { user_id: null } })
        .then(() => {
            res.status(200).send({ status: true, message: 'User logged out.' })
        });
});

router.post('/countTotalSystemEarning', verify, async (req, res) => {
    try {
        const user_transaction = await UserPayment.find({});

        let maintanance_amount = 0;
        let cashIn_amount = 0;
        let cashOut_amount = 0;
        let tryangle_earning = 0;
        let tryangle_purchase = 0;

        if (user_transaction.length > 0) {
            user_transaction.forEach(tran => {
                if (tran.description == 'Earning') {
                    maintanance_amount = maintanance_amount + parseFloat(tran.transaction_tax);
                }
                if (tran.description == 'IntoWallet') {
                    cashIn_amount += parseFloat(tran.transaction_amount);
                }
                if (tran.description == 'Cashout') {
                    cashOut_amount += parseFloat(tran.transaction_amount);
                }
                if (tran.description == 'Purchase') {
                    tryangle_purchase += parseFloat(tran.transaction_amount);
                }
            })
            tryangle_earning = cashIn_amount - cashOut_amount;
            res.status(200).send({ status: true, data: { maintanance_amount, tryangle_earning, tryangle_purchase } });
        }
        else {
            res.status(404).send({ status: false, message: 'No transaction found!.' });
        }
    }
    catch (err) {
        res.status(401).send({ status: false, message: 'Something went wrong!.', error: err.message });
    }
})

router.get('/filterUser', verify, async (req, res) => {

    const totalData = await User.find({ type: { $ne: 'admin' } }).countDocuments();
    console.log(totalData);
    await User.find({ type: { $ne: 'admin' } }).skip(parseInt(req.body.start)).limit(parseInt(req.body.length)).sort({ createdAt: -1 })
        .then(projects => {
            res.status(200).send({ status: true, data: projects, length: totalData });
        })
})

module.exports = router;