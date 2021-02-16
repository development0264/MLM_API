const router = require('express').Router();
const u = require('underscore');
var URL = require('url').URL;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('paypal-rest-sdk');
const verify = require('./verifyToken');
const config = require('../commonfunctions/config');
const Plan = require('../models/plans.model');
const UserPayment = require('../models/user_payments.model');
const PushNotification = require('../models/push_notification.model')
const sendNotification = require('../commonfunctions/sendPushNotification');
const AutoClose = require('../models/AutoClose.model');
const User = require('../models/user.model');
const InvitedUsers = require('../models/invited_users.model');
const UserTryangle = require('../models/user_tryangle.model');
const UserWallet = require('../models/user_wallet.model');
const apnProvider = require('../commonfunctions/APN_notification');
const apn = require('apn');
const sendMail = require('../commonfunctions/sendMail')

router.get('/', async (req, res) => {
    await Plan.find()
        .then(plans => {
            res.status(200).send({ status: true, data: plans });
        })
})

router.get('/filterPlan', async (req, res) => {

    const totalData = await Plan.find({}).countDocuments();
    await Plan.find().skip(parseInt(req.body.start)).limit(parseInt(req.body.length)).sort({ createdAt: -1 })
        .then(plans => {
            res.status(200).send({ status: true, data: plans, length: totalData });
        })
})

router.post('/:id', function (req, res) {
    Plan.findById(req.params.id)
        .then(plan => {
            res.json(plan)
        })
        .catch(err => res.status(400).json('Error: ' + err));
});

router.post('/add_plan', verify, async (req, res) => {
    const plan_title = req.body.plan_title;
    const plan_description = req.body.plan_description;
    const plan_amount = req.body.plan_amount;

    if (plan_title === null || plan_description === null || plan_amount === null) {
        res.status(401).json({ status: false, message: 'Title, Description and amount fields are required' });
    } else {
        const existsPlan = await Plan.find({ plan_amount: plan_amount });
        if (existsPlan.length > 0) {
            res.status(400).json({ status: false, message: 'Plan already exists', data: existsPlan });
        } else {
            var newPlan = new Plan({ plan_title, plan_description, plan_amount });
            const savedPlan = await newPlan.save();
            res.status(200).json({ status: true, message: 'Plan added', data: savedPlan });
        }
    }
});

router.post('/add_user_plan', verify, async (req, res) => {

    // Remove wallet logic and make payment from here only.
    // Check if someone has invited them or they have start their own trayangle
    // if invited then check if parent user has already 3 successful child.
    // if less then 3 then mark it is true for did_parent_accepted_tryangle
    // else flag will be false

    const user_id = req.body.user_id;
    const plan_id = req.body.plan_id;

    var parent_tryangle_id = null;
    const reqTryangleId = req.body.tryangle_id;

    if (reqTryangleId != null && reqTryangleId != '') {
        parent_tryangle_id = reqTryangleId;
        const is_invited = await InvitedUsers.findOne({ user_id: user_id, plan_id: plan_id, tryangle_id: parent_tryangle_id, accepted_status: 0 });
        if (!is_invited) {
            res.status(401).send({ status: false, message: 'You are not invitd into this tryangle or you have already reacted to this!.' });
            return;
        }
    }

    try {
        const userExists = await User.findById({ _id: user_id });

        if (!userExists) {
            res.status(400).send({ status: false, message: 'User must be registered to subscribe a plan!' })
        }
        else {
            const auto_close = await AutoClose.findOne({}).sort({ createdAt: -1 });

            const userFund = await UserWallet.findOne({ user_id: user_id });
            const planDetail = await Plan.findById({ _id: plan_id })

            let did_parent_accepted = false;
            const childTryangle = await UserTryangle.find({ parent_tryangle_id: parent_tryangle_id, isTryangleCreated: true }).countDocuments();
            console.log('childTryangle ------> ', childTryangle);
            if (childTryangle <= 3) {
                did_parent_accepted = true;
            }
            console.log('did_parent_accepted_tryangle -----> ', did_parent_accepted);


            if (planDetail.plan_amount <= userFund.fund) {
                var dedcutedFund = parseFloat(userFund.fund) - parseFloat(planDetail.plan_amount);
                await UserWallet.findOneAndUpdate({ user_id: user_id }, { $set: { fund: dedcutedFund } });
                var newTryangle = new UserTryangle({
                    isTryangleCreated: true,
                    tryangle_creation_datetime: new Date(),
                    user_id: user_id,
                    plan_id: plan_id,
                    parent_tryangle_id: parent_tryangle_id,
                    auto_close_in: auto_close.auto_close_days,
                    did_parent_accepted_tryangle: did_parent_accepted
                })
                const TryangleSaved = await newTryangle.save();

                var result = Math.abs(TryangleSaved.tryangle_creation_datetime - new Date()) / 1000;
                var close_remain_time = 14 - (Math.floor(result / 86400));

                // await User.findByIdAndUpdate({ _id: user_id }, { $set: { last_activity: 'This tryangle will auto close in ' + close_remain_time + ' days.' } });
                // await UserTryangle.findByIdAndUpdate({_id : TryangleSaved._id}, {$set : {last_activity: 'This tryangle will auto close in ' + close_remain_time + ' days.' }});
                await User.findByIdAndUpdate({ _id: user_id }, { $set: { last_activity: 'You have no current pending invitation.' } });
                await UserTryangle.findByIdAndUpdate({ _id: TryangleSaved._id }, { $set: { last_activity: 'You have no current pending invitation.' } });

                if (parent_tryangle_id) {
                    const user_parent = await UserTryangle.findById({ _id: parent_tryangle_id });
                    if (user_parent.is_one_joined == false) {
                        await UserTryangle.findByIdAndUpdate({ _id: parent_tryangle_id }, { $set: { is_one_joined: true, one_joined_at: TryangleSaved.tryangle_creation_datetime } });
                    }

                    const parentUserDetail = await User.findById({ _id: user_parent.user_id });

                    /* Send Notification to parent if someone accepts their invitation.*/

                    const notificationData = await PushNotification.find({ user_id: user_parent.user_id }, { registrationToken: 1, platform: 1 });
                    notificationData.forEach(ele => {
                        if (ele.platform == 'android') {
                            var payload = {
                                notification: {
                                    title: "Tryangle Invitation Accepted",
                                    body: "Someone has accepted you tryangle invitation."
                                }
                            };
                            sendNotification(ele.registrationToken, payload)
                        }
                        else if (ele.platform == 'ios') {
                            let notification = new apn.Notification({
                                alert: {
                                    title: "Tryangle Invitation Accepted",
                                    body: "Someone has accepted you tryangle invitation."
                                },
                                topic: 'com. .tryangle',
                                payload: {
                                    "sender": "node-apn",
                                },
                                pushType: 'background'
                            });

                            apnProvider.send(notification, ele.registrationToken)
                        }
                    })
                    var subject = 'Tryangle Invitation Accepted';
                    // var htmlText = 'Congrats ' + parentUserDetail.first_name + '. Your friend ' + userExists.first_name + ' has accepted your invitation and given $' + planDetail.plan_amount + ' into your Tryangle. Click below to see your Tryangle grow. <a href="tryangle://detail/' + parent_tryangle_id + '">[ MY $' + planDetail.plan_amount + ' TRYANGLE ]</a>';
                    var htmlText = '<!DOCTYPE html>' +
                        '<html>' +
                        '<head>' +
                        '  <title>Tryangle Invitation Accepted</title>' +
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
                        '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Congrats ' + parentUserDetail.first_name + '. Your friend ' + userExists.first_name + ' has accepted your invitation and given $' + planDetail.plan_amount + ' into your Tryangle. Click below to see your Tryangle grow. </p>' +
                        '<span style="background-color: #9B51E0;' +
                        '                  text-decoration: none;' +
                        '                  display: inline-block;' +
                        '                  color: #fff;' +
                        '                  font-family: Rubik, sans-serif;' +
                        '                  font-size: 14px;' +
                        '                  padding: 8px 15px;' +
                        '                  border-radius: 10px;">' +

                        '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=detail/' + parent_tryangle_id + '" style="text-decoration: none;color:#fff">MY $' + planDetail.plan_amount + ' TRYANGLE</a>' +
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
                        '         ">Privacy Statement</a>.</p>' + '      <p style="' +
                        '         color: #8593A6;' +
                        '         font-family: Rubik, sans-serif;' +
                        '         font-weight: 400;' +
                        '         font-size: 12px;' +
                        '         margin: 20px 0 0 0;' +
                        '         ">© 2020  , LLC. All rights reserved</p>' +
                        '   </div >' +
                        '</body >' +
                        '</html > '
                    // var htmlText = 'Someone has accepted you tryangle invitation.';
                    var toMail = parentUserDetail.email;
                    sendMail(toMail, subject, htmlText);

                    await User.findByIdAndUpdate({ _id: parentUserDetail._id }, { $set: { last_activity: userExists.first_name + ' just Joined your Tryangle' } })
                    await UserTryangle.findByIdAndUpdate({ _id: parent_tryangle_id }, { $set: { last_activity: userExists.first_name + ' just Joined your Tryangle' } })
                }
                /* add into user payment table*/
                var userPaymentData = new UserPayment({
                    user_id: user_id,
                    // payment_id: result.transaction.id,
                    description: 'Purchase',
                    purchased_status: 'completed',
                    //payer_id: customer_id,
                    payer_email: userExists.email,
                    payer_first_name: userExists.first_name,
                    payer_last_name: userExists.last_name,
                    transaction_amount: planDetail.plan_amount,
                    tryangle_id: TryangleSaved._id
                    // transaction_tax: 0,
                    // payment_method: payment_type,
                    // payment_card: 'payment_card'
                })
                await userPaymentData.save();

                await InvitedUsers.updateOne({
                    tryangle_id: parent_tryangle_id,
                    user_id: user_id,
                    accepted_status: 0
                }, {
                    $set: {
                        accepted_status: 1,
                        acceptedAt: new Date()
                    }
                });
                const initialMembers = await InvitedUsers.find({
                    tryangle_id: parent_tryangle_id,
                    accepted_status: 1
                })
                    .sort({ acceptedAt: 1 })
                    .limit(2);
                const intitalMemberIds = u.pluck(initialMembers, '_id');
                let is_initial_updated = await InvitedUsers.updateMany({
                    _id: {
                        $in: intitalMemberIds
                    }
                }, {
                    $set: {
                        is_initial: true
                    }
                });

                const countPending = await InvitedUsers.find({ user_id: user_id, accepted_status: 0 }).countDocuments();
                var activity;
                if (countPending == 0) {
                    activity = 'You have no current pending invitation.'
                }
                else {
                    activity = 'You have  ' + countPending + ' current pending invitations.'
                }
                await User.findByIdAndUpdate({ _id: user_id }, { $set: { last_activity: activity } });
                await UserTryangle.findByIdAndUpdate({ _id: TryangleSaved._id }, { $set: { last_activity: activity } });

                if (!is_initial_updated) {
                    res.status(401).send({ status: false, message: 'Something went wrong!!' });
                }

                let is_initial_tryangle = await UserTryangle.find({
                    parent_tryangle_id: parent_tryangle_id,
                    is_initial_tryangle: true
                }).countDocuments();

                if (is_initial_tryangle < 2) {
                    await UserTryangle.updateMany({ _id: newTryangle._id },
                        {
                            $set: {
                                is_initial_tryangle: true
                            }
                        });
                }

                /* to check if tryangle is completed or not if two child accepts the invitation */
                const invitedMembers = await UserTryangle.find({
                    parent_tryangle_id: parent_tryangle_id
                    // is_initial_tryangle: true
                }).countDocuments();
                if (invitedMembers === 2) {
                    if (parent_tryangle_id) {
                        await UserTryangle.findOneAndUpdate({ _id: newTryangle.parent_tryangle_id },
                            {
                                $set: {
                                    is_tryangle_finished: true,
                                    finished_datetime: new Date()
                                }
                            }).then(async (data) => {

                                const notificationData = await PushNotification.find({ user_id: data.user_id }, { registrationToken: 1, platform: 1 });

                                notificationData.forEach(ele => {
                                    if (ele.platform == 'android') {
                                        var payload = {
                                            notification: {
                                                title: "Tryangle Completion",
                                                body: "Your tryangle has been completed."
                                            }
                                        };
                                        sendNotification(ele.registrationToken, payload)
                                    }
                                    else if (ele.platform == 'ios') {
                                        let notification = new apn.Notification({
                                            alert: {
                                                title: "Tryangle Completion",
                                                body: "Your tryangle has been completed."
                                            },
                                            topic: 'com. .tryangle',
                                            payload: {
                                                "sender": "node-apn",
                                            },
                                            pushType: 'background'
                                        });

                                        apnProvider.send(notification, ele.registrationToken)
                                    }
                                })

                                const userEmail = await User.findById({ _id: data.user_id });

                                const parentTryan = await UserTryangle.findById({ _id: parent_tryangle_id });
                                try {
                                    if (parentTryan.parent_tryangle_id != null) {
                                        const headParentTryan = await UserTryangle.findById({ _id: parentTryan.parent_tryangle_id });
                                        console.log(userEmail.first_name);
                                        await User.findByIdAndUpdate({ _id: headParentTryan.user_id }, { $set: { last_activity: userEmail.first_name + ' Just completed their tryangle.' } })
                                        await UserTryangle.findByIdAndUpdate({ _id: headParentTryan._id }, { $set: { last_activity: userEmail.first_name + ' Just completed their tryangle.' } })

                                    }
                                }
                                catch (err) { }

                                var subject = 'Tryangle Completion';
                                var htmlText = '<!DOCTYPE html>' +
                                    '<html>' +
                                    '<head>' +
                                    '  <title>Tryangle Completion</title>' +
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
                                    '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Congratulations, ' + userEmail.first_name + ' Your tryangle has been completed. wait for your child to complete their tryangle so that you can cashout your money.</p>' +
                                    '<span style="background-color: #9B51E0;' +
                                    '                  text-decoration: none;' +
                                    '                  display: inline-block;' +
                                    '                  color: #fff;' +
                                    '                  font-family: Rubik, sans-serif;' +
                                    '                  font-size: 14px;' +
                                    '                  padding: 8px 15px;' +
                                    '                  border-radius: 10px;">' +
                                    '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=detail/' + parent_tryangle_id + '" style="text-decoration: none;color:#fff">View My Trangle</a>' +
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
                                // var htmlText = 'Your tryangle has been completed. <a href="http:// tryangle://detail/:' + parent_tryangle_id + '">[View My Trangle]</a>';
                                var toMail = userEmail.email;
                                sendMail(toMail, subject, htmlText);
                            });
                    }
                }
                res.status(200).send({ status: true, message: 'OK', tryangle_id: TryangleSaved._id });
            }
            else {
                res.status(400).send({ status: false, message: 'you do not have enough fund to buy this plan' });
            }
        }
    } catch (err) {

        res.status(401).send({ status: false, message: err.message });
    }
});

router.post('/user_purchased_plans', verify, async (req, res) => {
    const user_id = req.body.user_id;
    try {
        var findPlans = {
            user_id: user_id,
            isTryangleCreated: true,
            is_closed: false
        }
        let getUserPlans = await UserTryangle.find(findPlans);

        if (getUserPlans.length > 0) {
            res.status(200).json({ status: true, data: getUserPlans });
        }
        else {
            res.status(200).json({ status: false, msg: 'no plans found' })
        }
    }
    catch (err) {
        res.status(401).send({ status: false, message: err })
    }
})

// Admin panel functionalities - to the end

router.get('/filterPlan', async (req, res) => {

    const totalData = await Plan.find({}).countDocuments();
    await Plan.find().skip(parseInt(req.body.start)).limit(parseInt(req.body.length))
        .then(plans => {
            res.status(200).send({ status: true, data: plans, length: totalData });
        })
})

router.get('/update_plan', verify, async (req, res) => {
    const plan_title = req.body.plan_title;
    const plan_description = req.body.plan_description;
    const plan_amount = req.body.plan_amount;
    const id = req.body.id;
    await Plan.findOneAndUpdate({ _id: id },
        {
            $set: {
                plan_title: plan_title,
                plan_description: plan_description,
                plan_amount: plan_amount
            }
        });
    res.status(200).json({ status: true, message: 'Plan updated' });
});

router.post('/deletePlan/:id', function (req, res) {
    Plan.deleteOne({ _id: req.params.id })
        .then(plan => {
            res.json(plan)
        })
        .catch(err => res.status(400).json('Error: ' + err));
});

router.get('/add_plan', verify, async (req, res) => {
    const plan_title = req.body.plan_title;
    const plan_description = req.body.plan_description;
    const plan_amount = req.body.plan_amount;

    if (plan_title === null || plan_description === null || plan_amount === null) {
        res.status(401).json({ status: false, message: 'Title, Description and amount fields are required' });
    } else {
        const existsPlan = await Plan.find({ plan_amount: plan_amount });
        if (existsPlan.length > 0) {
            res.status(400).json({ status: false, message: 'Plan already exists', data: existsPlan });
        } else {
            var newPlan = new Plan({ plan_title, plan_description, plan_amount });
            const savedPlan = await newPlan.save();
            res.status(200).json({ status: true, message: 'Plan added', data: savedPlan });
        }
    }
});


module.exports = router;