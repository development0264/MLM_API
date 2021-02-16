const router = require('express').Router();
const u = require('underscore');
const config = require('../commonfunctions/config');
const verify = require('./verifyToken')
const sendMail = require('../commonfunctions/sendMail')
const InvitedUsers = require('../models/invited_users.model');
let Plan = require('../models/plans.model');
let User = require('../models/user.model');
const PushNotification = require('../models/push_notification.model')
const sendNotification = require('../commonfunctions/sendPushNotification');
const AutoClose = require('../models/AutoClose.model');
// const UserPayment = require('../models/user_payments.model');
const UserTryangle = require('../models/user_tryangle.model');
const { vadidateEmail } = require('../commonfunctions/config');
const apnProvider = require('../commonfunctions/APN_notification');
const apn = require('apn');
const navigator = require('navigator');
const Bowser = require("bowser");

const Window = require('window');

const window = new Window();

router.post('/add_invitation', verify, async (req, res) => {
    /* get all fields from front end side */
    var emailArray = [];
    const tryangle_id = req.body.tryangle_id;
    var accepted_status = 0;
    var deleted_status = 0;
    var plan_id = null;
    var parent_id = null;
    var u_id = null;
    var is_closed = null;
    var alreadyInvitedUsers = [];

    for (let i = 0; i < req.body.email.length; i++) {
        emailArray[i] = req.body.email[i].toLowerCase();
    }

    /* send invitation to multiple Emails */
    if (tryangle_id && emailArray) {

        const userTryangle = await UserTryangle.findById({ _id: tryangle_id });
        const userDetail = await User.findById({ _id: userTryangle.user_id });

        if (tryangle_id === null || emailArray === null) {
            res.status(400).send({ status: false, message: 'Email & tryangle details are required' });
        }
        if (userDetail.status != 1) {
            res.status(400).send({ status: false, message: 'Verify your Email to Invite others' });
        }
        else {
            try {
                const validTryangle = await UserTryangle.findById({ _id: tryangle_id, isTryangleCreated: true })
                is_closed = validTryangle.is_closed;
                plan_id = validTryangle.plan_id;
                parent_id = validTryangle.user_id;
                const planDetail = await Plan.findById({ _id: plan_id });
                if (validTryangle) {
                    if (is_closed === false) {
                        // if (eligibleToInvite.purchased_status === 'completed') {
                        for (let i = 0; i < emailArray.length; i++) {
                            var userExists = await User.find({ email: emailArray[i] }, { _id: 1 });
                            if (userExists.length > 0) {
                                u_id = userExists[0]._id;
                            }
                            else {
                                u_id = null;
                            }
                            var exists = await InvitedUsers.find({ email: emailArray[i], tryangle_id: tryangle_id, accepted_status: { $ne: 2 } })
                            if (exists.length > 0) {
                                alreadyInvitedUsers.push({
                                    email: emailArray[i]
                                })
                            }
                            else {
                                const a = await UserTryangle.findByIdAndUpdate({ _id: tryangle_id }, { $set: { last_invited: new Date() } });
                                let invitation = new InvitedUsers({
                                    email: emailArray[i],
                                    user_id: u_id,
                                    plan_id: plan_id,
                                    parent_id: parent_id,
                                    tryangle_id: tryangle_id,
                                    accepted_status: accepted_status,
                                    deleted_status: deleted_status
                                });
                                const result = await invitation.save();

                                let invited_userPhoto = 'https://svgsilh.com/svg/1368712.svg';
                                invitation_id = result._id;
                                if (u_id) {
                                    invited_userPhoto = userExists[0].profile_photo;
                                }

                                var subject = 'Tyrangle Invitation';
                                // var htmlText = 'Hey ' + emailArray[i] + '.' + userDetail.first_name + ' invited you to her $' + planDetail.plan_amount + ' Tryangle. Click below to join in on the fun, give and multiply your money.  <a href=tryangle://request/' + tryangle_id + '>[ JOIN IN ]</a>'
                                // var htmlText = '<table cellspacing="5%" cellpadding="5%" style="background-color: #FFFFCC;"><tr><td><table cellspacing="3%" cellpadding="3%"><tr><td style="border-radius: 2px; font-size:120%;text-align: center;" >Hey ' + emailArray[i] + '.' + userDetail.first_name + ' invited you to her $' + planDetail.plan_amount + ' Tryangle. Click below to join in on the fun, give and multiply your money. Please.<a href="http://github.com" target="_blank" style="padding: 8px 12px; font-family: Helvetica, Arial, sans-serif; color: #9B51E0;text-decoration: none;font-weight:bold;display: inline-block;"> Click Here</a>to download the App or login</td></tr><tr><td style="border-radius: 2px; text-align:center; font-size:130%;"><a href="' + config.myIP + '/api/invitations/change_status/' + invitation_id + '/?status=1" target="_blank" style="padding: 8px 12px; font-family: Helvetica, Arial, sans-serif;  background-color: #9B51E0; color: #ffffff; border-radius: 8px; text-decoration: none;font-weight:bold;display: inline-block; ">JOIN IN</a><a href="' + config.myIP + '/api/invitations/change_status/' + invitation_id + '/?status=2" target="_blank" style="padding: 8px 12px; font-family: Helvetica, Arial, sans-serif; background-color: #9B51E0; color: #ffffff; border-radius: 8px; margin-left:3%; text-decoration: none;font-weight:bold;display: inline-block;">PASS </a></td></tr></table> </td> </tr> </table>';
                                var htmlText = '<!DOCTYPE html>' +
                                    '<html>' +
                                    '<head>' +
                                    '  <title>Tyrangle Invitation</title>' +
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
                                    '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Hi ' + emailArray[i] + '<br>' + userDetail.first_name + ' invited you to her $' + planDetail.plan_amount + ' Tryangle. Click below to join in on the fun, give and multiply your money.</p>' +
                                    '     <div style="' +
                                    '        display: flex;' +
                                    '        align-items: self-start;' +
                                    '        ">' +
                                    '        <div style="' +
                                    '           position: relative;' +
                                    '           padding-top: 28px;' +
                                    '           ">' +
                                    // '           <svg width="67" height="66" viewBox="0 0 67 66" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
                                    // '              <rect x="2" y="1.5" width="63" height="63" rx="31.5" fill="url(#pattern0)" stroke="#9B51E0" stroke-width="3"></rect>' +
                                    // '              <defs>' +
                                    // '                 <pattern id="pattern0" patternContentUnits="objectBoundingBox" width="1" height="1">' +
                                    // '                    <use xlink:href="#image0" transform="translate(-0.25) scale(0.00285714)"></use>' +
                                    // '                 </pattern>' +

                                    // // '                   <img src = "' + config.myIP + '/profileImages/' + userDetail.profile_photo + '">     ' +
                                    // '             </defs>' +
                                    // '           </svg>' +
                                    // '<img style="' +
                                    // 'width: 63px;' +
                                    // 'height: 63px;' +
                                    // 'object-fit: cover;' +
                                    // 'border-radius: 100%;' +
                                    // 'border: 3px solid #9b51e0;' +
                                    // '" src="https://manofmany.com/wp-content/uploads/2019/06/50-Long-Haircuts-Hairstyle-Tips-for-Men-2.jpg">' +
                                    // '          <span style="' +
                                    // '             position: absolute;' +
                                    // '             background: #9B51E0;' +
                                    // '             display: flex;' +
                                    // '             align-items: center;' +
                                    // '             font-family: Rubik, sans-serif;' +
                                    // '             color: #fff;' +
                                    // '             padding: 3px 10px;' +
                                    // '             font-size: 13px;' +
                                    // '             border-radius: 3px;' +
                                    // '             bottom: -11px;' +
                                    // '                 left: 50%;' +
                                    // '             transform: translateX(-50%);' +
                                    // '">' + userDetail.first_name + '</span>' +
                                    // '           </div >' +
                                    // '           <div style="padding-top: 55px;margin-left: 10px;width: 100px;border-bottom: 2px dashed #BDBDBD;">' +
                                    // '          </div>' +
                                    // '          <div style="' +
                                    // ' padding-left: 0;' +
                                    // ' ">' +
                                    // '             <div style="' +
                                    // ' text-align: center;' +
                                    // ' ">' +

                                    //*********** */
                                    // '                <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
                                    // '                   <g filter="url(#filter0_d)">' +
                                    // '                      <circle cx="60" cy="56" r="50" fill="url(#pattern0)"></circle>' +
                                    // '                   </g>' +
                                    // '                   <defs>' +
                                    // '                      <filter id="filter0_d" x="0" y="0" width="120" height="120" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">' +
                                    // '                         <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>' +
                                    // '                         <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"></feColorMatrix>' +
                                    // '                         <feOffset dy="4"></feOffset>' +
                                    // '                         <feGaussianBlur stdDeviation="5"></feGaussianBlur>' +
                                    // '                         <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.14 0"></feColorMatrix>' +
                                    // '                         <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"></feBlend>' +
                                    // '                         <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"></feBlend>' +
                                    // '                      </filter>' +
                                    // '                      <pattern id="pattern0" patternContentUnits="objectBoundingBox" width="1" height="1">' +
                                    // '                         <use xlink:href="#image0" transform="scale(0.0025)"></use>' +
                                    // '                      </pattern>' +

                                    // // '                          <img src = "' + config.myIP + '/profileImages/' + invited_userPhoto + '"   >  ' +
                                    // '                  </defs>' +
                                    // '               </svg >' +
                                    //************* */
                                    // '<img style="' +
                                    // 'width: 100px;' +
                                    // 'height: 100px;' +
                                    // 'object-fit: cover;' +
                                    // 'border-radius: 100%;' +
                                    // 'filter: drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.14));' +
                                    // '" src="https://manofmany.com/wp-content/uploads/2019/06/50-Long-Haircuts-Hairstyle-Tips-for-Men-2.jpg">' +
                                    // '            </div >' +
                                    ' <div style="' +
                                    '               text-align: center;' +
                                    '               margin-top: 13px;' +
                                    '               ">' +
                                    '     <a href="' + config.myIP + '/api/invitations/change_status/' + invitation_id + '/?status=1" style="' +
                                    '                  background-color: #219653;' +
                                    '                  text-decoration: none;' +
                                    '                  display: inline-block;' +
                                    '                  color: #fff;' +
                                    '                  font-family: Rubik, sans-serif;' +
                                    '                  font-size: 14px;' +
                                    '                  padding: 8px 15px;' +
                                    '                  border-radius: 10px;' +
                                    '                  ">Join</a>' +
                                    '     <a href="' + config.myIP + '/api/invitations/change_status/' + invitation_id + '/?status=2" style="' +
                                    '                  background-color: #DF4741;' +
                                    '                  text-decoration: none;' +
                                    '                  display: inline-block;' +
                                    '                  color: #fff;' +
                                    '                  font-family: Rubik, sans-serif;' +
                                    '                  font-size: 14px;' +
                                    '                  padding: 8px 15px;' +
                                    '                  border-radius: 10px;' +
                                    '                  ">Pass</a>' +
                                    ' </div>' +
                                    '         </div >' +
                                    '      </div >' +
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
                                var toMail = emailArray[i];
                                sendMail(toMail, subject, htmlText);

                                /*Push notification to notify that someone has invited them to tryangle.*/
                                if (u_id !== null) {
                                    const notificationData = await PushNotification.find({ user_id: u_id }, { registrationToken: 1, platform: 1 });
                                    notificationData.forEach(ele => {
                                        if (ele.platform == 'android') {
                                            var payload = {
                                                notification: {
                                                    title: "Tryangle Invitation",
                                                    body: "Someone has invited to join their tryangle."
                                                }
                                            };
                                            sendNotification(ele.registrationToken, payload)
                                        }
                                        else if (ele.platform == 'ios') {
                                            let notification = new apn.Notification({
                                                alert: {
                                                    title: 'Tryangle Invitation',
                                                    body: 'Someone has invited to join their tryangle.'
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
                                }

                                // const totalInvited = await InvitedUsers.find({ tryangle_id: tryangle_id }).countDocuments();
                                // if (totalInvited == 1 ) {
                                //     await User.findByIdAndUpdate({ _id: userDetail._id }, { $set: { last_activity: 'You have just Invited ' + totalInvited + ' friend.' } });    
                                // }
                                // else{
                                //     await User.findByIdAndUpdate({ _id: userDetail._id }, { $set: { last_activity: 'You have just Invited ' + totalInvited + ' friends.' } });
                                // }

                            }
                        }
                        // if (emailArray.length == 1) {
                        //     await UserTryangle.findByIdAndUpdate({_id: tryangle_id}, { $set: { last_activity: 'You have just Invited ' + emailArray.length + ' friend.' } });
                        // }
                        // else{
                        //     await UserTryangle.findByIdAndUpdate({_id: tryangle_id}, { $set: { last_activity: 'You have just Invited ' + emailArray.length + ' friends.' } });
                        // }
                        res.status(200).send({ status: true, message: "Mail has been send only to new users." });
                    }
                    else {
                        res.status(400).send({ status: false, message: 'Closed tryangle, You can not invite other into this tryangle.' });
                    }
                }
                else {
                    res.status(400).send({ status: false, message: 'Invalid tryangle' });
                }
            }
            catch (err) {
                res.status(400).send({ status: false, message: 'Something went wrong' });
            }
        }
    } else {
        res.status(400).send({ status: false, message: 'Email, Plan & parent user details are required' });
    }
});


/* to change invitation status & add member into tryangle*/
router.get('/change_status/:invitation_id', function (req, res) {
    var MobileDetect = require('mobile-detect'),
        md = new MobileDetect(req.headers['user-agent']);
    var invite_id = req.params.invitation_id;
    var invitation_status = req.query.status;

    InvitedUsers.findById({ _id: invite_id }, {}).then(async (InvitedUserDetail) => {
        if (InvitedUserDetail.isLinkAlive === true) {
            if (invitation_status == 1) {

                var checkRegistered = await InvitedUsers.findById({ _id: invite_id });
                if (checkRegistered.user_id === null) {
                    const redirectTo = config.myIP + '/api/check/browserCheck';
                    res.redirect(redirectTo);
                }
                else {
                    res.redirect('tryangle://request/' + invite_id);
                    // res.redirect('http://open-tryangleapp.com');
                }
            }
            if (invitation_status == 2) {
                InvitedUsers.findByIdAndUpdate({ _id: invite_id }, { $set: { accepted_status: 2, isLinkAlive: false } }, (err, doc) => {
                    if (err) {
                        res.status(401).send({ status: false, message: 'Couldn\'t update status' + err })
                    }
                    else {
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
                            '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Opps, You have Rejected Invitation</p>' +
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
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.write(htmlText);
                        res.end();
                    }
                })
            }
        }
        else {
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
                '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">You have already reacted to this</p>' +
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
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(htmlText);
            res.end();
        }
    })
        .catch(err => {
            console.log(err);
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
                '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Something went wrong.<br>' + err + ' </p>' +
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
            res.writeHead(401, { 'Content-Type': 'text/html' });
            res.write(htmlText);
            res.end();
        });
})

router.post('/single_invitation_list', verify, async (req, res) => {
    const invitation_id = req.body.invitation_id;
    let response = [];
    const invitationDetail = await InvitedUsers.findById({ _id: invitation_id, accepted_status: 0 }, { user_id: 1, tryangle_id: 1, plan_id: 1, parent_id: 1 });
    const userDetail = await User.findById({ _id: invitationDetail.parent_id }, { first_name: 1, last_name: 1, email: 1, profile_photo: 1, paypal_id: 1 });
    const planDetail = await Plan.findById({ _id: invitationDetail.plan_id }, { plan_title: 1, plan_amount: 1 });
    response.push({
        invitation_id: invitationDetail._id,
        tryangle_id: invitationDetail.tryangle_id,
        userID: invitationDetail.user_id,
        parentDetails: userDetail,
        planDetail: planDetail
    })
    res.status(200).send({ status: true, data: response })
})

router.post('/checkInvited_or_registered', verify, async (req, res) => {
    let emailArray = [];
    let plan_id = req.body.plan_id;
    let parent_id = req.body.parent_id;
    var inviteStatus = [];
    var registerStatus = [];
    var mergerdArray = [];
    var supportArray = [];
    var exists;
    var c = 0;

    for (let i = 0; i < req.body.email.length; i++) {
        emailArray[i] = req.body.email[i].toLowerCase();
    }

    if (emailArray && plan_id && parent_id) {
        var foundInvitedUser = await InvitedUsers.find({ email: { $in: emailArray }, plan_id: plan_id, parent_id: parent_id, }, { email: 1, createdAt: 1 });

        for (let i = 0; i < foundInvitedUser.length; i++) {
            inviteStatus.push({ 'email': foundInvitedUser[i].email, 'email_invited': true, 'InvitedAt': foundInvitedUser[i].createdAt });
        }

        var foundRegisteredUser = await User.find({ email: { $in: emailArray } }, { email: 1 });
        for (let i = 0; i < foundRegisteredUser.length; i++) {
            registerStatus.push({ 'email': foundRegisteredUser[i].email, 'email_Registered': true });
        }
        var data = inviteStatus.concat(registerStatus);

        data.forEach(ele => {
            exists = supportArray.some(item => {
                return item.email === ele.email;
            });

            if (exists === false) {
                mergerdArray[ele.email] = ele;
                supportArray[c] = ele;
            }
            else {
                var email_invited = mergerdArray[ele.email].email_invited !== undefined ? mergerdArray[ele.email].email_invited : ele.email_invited;
                var email_Registered = mergerdArray[ele.email].email_Registered !== undefined ? mergerdArray[ele.email].email_Registered : ele.email_Registered;
                var InvitedAt = mergerdArray[ele.email].InvitedAt !== undefined ? mergerdArray[ele.email].InvitedAt : ele.DateTime;
                var combinedData = {
                    email: ele.email,
                    email_invited: email_invited,
                    email_Registered: email_Registered,
                    InvitedAt: InvitedAt
                }
                mergerdArray[ele.email] = combinedData;
            }
            c++;
        })
        let finalResponse = {}
        for (var key in mergerdArray) {
            finalResponse[key] = mergerdArray[key]
        }
        res.status(200).send({ status: true, data: finalResponse });
    }
    else {
        res.status(400).send({ status: false, message: 'Email, Plan_id & Parent_id are Required' });
    }
});

router.post('/list_invitationRequest', verify, async (req, res) => {
    var email = req.body.email.toLowerCase();
    var p_id = [];
    var requestInfo = [];
    var getUserInfo = [];

    if (email) {
        var pendingInvitationInfo = await InvitedUsers.find({ email: email, accepted_status: 0 }, { parent_id: 1, plan_id: 1, tryangle_id: 1, createdAt: 1 });
        if (pendingInvitationInfo.length > 0) {
            getUserInfo = await User.find({ email: email }, { email: 1 });
        }
        await InvitedUsers.aggregate([
            { $match: { email: { $eq: email }, accepted_status: { $eq: 0 } } },
            { $group: { _id: { plan_id: "$plan_id" } } }
        ]).then((obj) => {
            for (let i = 0; i < obj.length; i++) {
                var plan_id = obj[i]._id.plan_id;
                p_id.push({ 'plan_id': plan_id });
            }
        });
        var plan = u.pluck(p_id, 'plan_id');
        var planDetail = await Plan.find({ _id: { $in: plan } }, { _id: 1, plan_amount: 1 });
        var getParent = await InvitedUsers.find({ plan_id: { $in: plan }, email: email }, { parent_id: 1, plan_id: 1, tryangle_id: 1 });
        pendingInvitationInfo.forEach(ele => {
            requestInfo.push({ 'invitation_id': ele._id, 'parent_id': ele.parent_id, 'plan_id': ele.plan_id, 'tryangle_id': ele.tryangle_id, invitedAt: ele.createdAt });
        })
        // getParent.forEach(ele => {
        //     requestInfo.push({ 'invitation_id': ele._id, 'parent_id': ele.parent_id, 'plan_id': ele.plan_id, 'tryangle_id': ele.tryangle_id });
        // })
        var parentId = u.pluck(getParent, 'parent_id');
        var getParentInfo = await User.find({ _id: { $in: parentId } }, { email: 1, first_name: 1, last_name: 1, profile_photo: 1 });
        res.status(200).json({ status: true, 'userInfo': getUserInfo, 'planDetail': planDetail, 'requestInfo': requestInfo, 'getParentInfo': getParentInfo })
    }
    else {
        res.status(400).send({ status: false, message: 'Email id is required.' });
    }
});

module.exports = router;