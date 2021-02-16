const router = require('express').Router();
const u = require('underscore');
const verify = require('./verifyToken');
const sendNotification = require('../commonfunctions/sendPushNotification');
let Plan = require('../models/plans.model');
let User = require('../models/user.model');
const InvitedUsers = require('../models/invited_users.model');
const UserTrayangle = require('../models/user_tryangle.model');
const PushNotification = require('../models/push_notification.model');
const MaintenanceFee = require('../models/MaintenanceFee_config.model');
const UserPayment = require('../models/user_payments.model');
const cron = require('node-cron');
const UserWallet = require('../models/user_wallet.model');
const AutoClose = require('../models/AutoClose.model');
const apnProvider = require('../commonfunctions/APN_notification');
const apn = require('apn');
const sendMail = require('../commonfunctions/sendMail');
const config = require('../commonfunctions/config');

router.post('/autoClose', verify, async (req, res) => {
    try {
        const closingDays = req.body.closingDays;
        const closeDayData = new AutoClose({
            auto_close_days: closingDays
        });
        const a = await closeDayData.save();
        res.status(200).send(a);
    }
    catch (err) {
        res.status(401).send(err);
    }
})

router.get('/filterAutoclose', verify, async (req, res) => {
    const totalData = await AutoClose.find({}).countDocuments();
    await AutoClose.find().skip(parseInt(req.body.start)).limit(parseInt(req.body.length)).sort({ createdAt: -1 })
        .then(autoclose => {
            res.status(200).send({ status: true, data: autoclose, length: totalData });
        })
})

router.post('/config_fee', verify, async (req, res) => {
    try {
        const { maintenance_fee } = req.body;
        const fee_data = new MaintenanceFee({
            maintenance_fee: maintenance_fee
        });
        const fee = await fee_data.save();
        res.status(200).send(fee);
    }
    catch (err) {
        res.status(401).send({
            status: false,
            message: 'Something went wrong',
            error: err.message
        })
    }
})

router.get('/filterMaintenance', verify, async (req, res) => {
    const totalData = await MaintenanceFee.find({}).countDocuments();
    await MaintenanceFee.find().skip(parseInt(req.body.start)).limit(parseInt(req.body.length)).sort({ createdAt: -1 })
        .then(maintenance_fee => {
            res.status(200).send({ status: true, data: maintenance_fee, length: totalData });
        })
})

/* To list tryangle of single user */
router.post('/list_tryangle', verify, async (req, res) => {

    // show accepted trayngle of user in slot of 3.
    // with plan amount
    // last invited datetime
    // successful child info

    // if one child has completed their tryangle then show them remaining days & the earned amount

    const user_id = req.body.user_id;
    var parentUserRes = [];
    var parentTryangleRes = [];
    var childUserRes = [];
    var subChildRes = [];
    var invitedOnly = [];
    var plan_info = [];
    var finalRes = [];
    var pendingUser = [];
    var pending_userInfo = [];

    const user_info = await User.findById({ _id: user_id }, { email: 1, first_name: 1, last_name: 1, profile_photo: 1 });
    parentUserRes.push(user_info);
    const user_tryangles = await UserTrayangle.find({ user_id: user_id, isTryangleCreated: true, did_parent_accepted_tryangle: true });
    const user_parentTryangleIDs = u.pluck(user_tryangles, 'parent_tryangle_id');
    let user_parentTryangleID = [];
    user_parentTryangleIDs.forEach(ele => {
        if (ele != '') {
            user_parentTryangleID.push(ele);
        }
    })
    const parentTryangle = await UserTrayangle.find({ _id: { $in: user_parentTryangleID } });
    const parent_userId = u.pluck(parentTryangle, 'user_id');
    const parent_userInfo = await User.find({ _id: { $in: parent_userId } });

    user_tryangles.forEach(async (ele) => {
        var result = Math.abs(ele.createdAt - new Date()) / 1000;
        var close_remain_time = 14 - (Math.floor(result / 86400));
        let userTryangleDetail = {
            isTryangleCreated: ele.isTryangleCreated,
            is_closed: ele.is_closed,
            is_manual_closed: ele.is_manual_closed,
            is_tryangle_finished: ele.is_tryangle_finished,
            tryangle_id: ele._id,
            plan_id: ele.plan_id,
            user_id: ele.user_id,
            parent_tryangle_id: ele.parent_tryangle_id,
            purchase_dateTime: ele.createdAt,
            updatedAt: ele.updatedAt,
            close_remain_time: close_remain_time,
            last_invited: ele.last_invited,
        }
        parentTryangleRes.push(userTryangleDetail);
    });

    const user_tryangle_id = u.pluck(user_tryangles, '_id');

    var expected_earning = [];
    for (let i = 0; i < user_tryangles.length; i++) {
        const total_invited_by_tryangle = await InvitedUsers.find({ tryangle_id: user_tryangles[i]._id, accepted_status: 1 }).countDocuments();
        if (total_invited_by_tryangle > 0) {
            await Plan.findById({ _id: user_tryangles[i].plan_id }, { plan_amount: 1 }).then(data => {
                expected_earning.push({
                    tryangle_id: user_tryangles[i]._id,
                    // expected_earning_amount: (data.plan_amount * (total_invited_by_tryangle - 1))
                    expected_earning_amount: ((data.plan_amount * (total_invited_by_tryangle - 1)) + (data.plan_amount / 2))
                })
            });
        }
        else {
            expected_earning.push({
                tryangle_id: user_tryangles[i]._id,
                expected_earning_amount: 0
            })
        }
    }

    let parentInfo;
    for (let i = 0; i < parentTryangleRes.length; i++) {
        if (parentTryangleRes[i].tryangle_id === expected_earning[i].tryangle_id) {
            if (parentTryangleRes[i].parent_tryangle_id != '') {
                for (let j = 0; j < parentTryangle.length; j++) {
                    if (parentTryangleRes[i].parent_tryangle_id == parentTryangle[j]._id) {
                        for (let k = 0; k < parent_userInfo.length; k++) {
                            if (parentTryangle[j].user_id == parent_userInfo[k]._id) {
                                parentInfo = {
                                    user_id: parent_userInfo[k]._id,
                                    first_name: parent_userInfo[k].first_name,
                                    last_name: parent_userInfo[k].last_name,
                                    email: parent_userInfo[k].email,
                                    profile_photo: parent_userInfo[k].profile_photo
                                }
                            }
                        }
                    }

                }
                finalRes.push({
                    isTryangleCreated: parentTryangleRes[i].isTryangleCreated,
                    is_closed: parentTryangleRes[i].is_closed,
                    is_manual_closed: parentTryangleRes[i].is_manual_closed,
                    is_tryangle_finished: parentTryangleRes[i].is_tryangle_finished,
                    tryangle_id: parentTryangleRes[i].tryangle_id,
                    plan_id: parentTryangleRes[i].plan_id,
                    user_id: parentTryangleRes[i].user_id,
                    parent_tryangle_id: parentTryangleRes[i].parent_tryangle_id,
                    purchase_dateTime: parentTryangleRes[i].purchase_dateTime,
                    updatedAt: parentTryangleRes[i].updatedAt,
                    // payment_id: parentTryangleRes[i].payment_id,
                    close_remain_time: parentTryangleRes[i].close_remain_time,
                    last_invited: parentTryangleRes[i].last_invited,
                    expected_earning_amount: expected_earning[i].expected_earning_amount,
                    InvitedBy: parentInfo
                })
            }
            else {
                finalRes.push({
                    isTryangleCreated: parentTryangleRes[i].isTryangleCreated,
                    is_closed: parentTryangleRes[i].is_closed,
                    is_manual_closed: parentTryangleRes[i].is_manual_closed,
                    is_tryangle_finished: parentTryangleRes[i].is_tryangle_finished,
                    tryangle_id: parentTryangleRes[i].tryangle_id,
                    plan_id: parentTryangleRes[i].plan_id,
                    user_id: parentTryangleRes[i].user_id,
                    parent_tryangle_id: parentTryangleRes[i].parent_tryangle_id,
                    purchase_dateTime: parentTryangleRes[i].purchase_dateTime,
                    updatedAt: parentTryangleRes[i].updatedAt,
                    // payment_id: parentTryangleRes[i].payment_id,
                    close_remain_time: parentTryangleRes[i].close_remain_time,
                    last_invited: parentTryangleRes[i].last_invited,
                    expected_earning_amount: expected_earning[i].expected_earning_amount,
                })
            }

        }
    }

    const plan_ids = u.pluck(user_tryangles, 'plan_id');
    await Plan.distinct('_id', { _id: { $in: plan_ids } }).then((planDet) => {
        Plan.find({ _id: { $in: planDet } }).then((data) => {
            data.forEach(ele => {
                let planDetail = {
                    plan_id: ele._id,
                    plan_title: ele.plan_title,
                    plan_description: ele.plan_description,
                    plan_amount: ele.plan_amount
                }
                plan_info.push(planDetail);
            })
        });
    });
    var child = [];
    const pending = await InvitedUsers.find({ tryangle_id: { $in: user_tryangle_id }, accepted_status: 0 });
    pending.forEach(ele => {
        if (ele) {
            invitedOnly.push({
                is_initial: ele.is_initial,
                user_id: ele.user_id,
                email: ele.email,
                parent_id: ele.parent_id,
                parent_tryangle_id: ele.tryangle_id,
                accepted_status: ele.accepted_status,
                invitedAt: ele.createdAt,
                plan_id: ele.plan_id
            })
        }
    })
    const pending_user = u.pluck(pending, 'user_id');
    const pending_user_info = await User.find({ _id: pending_user });
    pending_user_info.forEach(ele => {
        if (ele) {
            pending_userInfo.push({
                user_id: ele.user_id,
                email: ele.email,
                first_name: ele.first_name,
                last_name: ele.last_name,
                profile_photo: ele.profile_photo
            })
        }
    })



    const child_tryangle = await UserTrayangle.find({ parent_tryangle_id: { $in: user_tryangle_id }, isTryangleCreated: true }).sort({ finished_datetime: 1 });
    const parentTryanIds = u.pluck(child_tryangle, 'parent_tryangle_id');
    const childUserIds = u.pluck(child_tryangle, 'user_id');
    const childPlanIds = u.pluck(child_tryangle, 'plan_id');
    const parentTryan = await UserTrayangle.find({ _id: { $in: parentTryanIds } });
    const invitedChild = await InvitedUsers.find({ tryangle_id: { $in: parentTryanIds }, accepted_status: 1, user_id: { $in: childUserIds } });
    const childPlan = await Plan.find({ _id: { $in: childPlanIds } });

    let c;
    let p;
    let testParent = [];
    child_tryangle.forEach(ele => {
        parentTryan.forEach(ele1 => {
            if (ele.parent_tryangle_id == ele1._id) {
                invitedChild.forEach(ele2 => {
                    if (ele2.tryangle_id == ele.parent_tryangle_id && ele2.user_id == ele.user_id) {
                        let checkExist = testParent.includes(ele.parent_tryangle_id);
                        childPlan.forEach(ele3 => {
                            let gaveGift;
                            if (ele3._id == ele.plan_id) {
                                if (ele.is_tryangle_finished == true) {
                                    if (ele1.tryangle_close_dateTime) {
                                        if (ele.finished_datetime < ele1.tryangle_close_dateTime) {
                                            if (checkExist == false) {
                                                gaveGift = ele3.plan_amount / 2;
                                                testParent.push(ele.parent_tryangle_id);
                                            }
                                            else {
                                                gaveGift = ele3.plan_amount
                                            }
                                        }
                                    }
                                    else {
                                        if (checkExist == false) {
                                            gaveGift = ele3.plan_amount / 2;
                                            testParent.push(ele.parent_tryangle_id);
                                        }
                                        else {
                                            gaveGift = ele3.plan_amount
                                        }
                                    }
                                }
                                var result = Math.abs(ele.createdAt - new Date()) / 1000;
                                var close_remain_time = 14 - (Math.floor(result / 86400));
                                let childTryangleDetail = {
                                    isTryangleCreated: ele.isTryangleCreated,
                                    is_closed: ele.is_closed,
                                    is_manual_closed: ele.is_manual_closed,
                                    is_tryangle_finished: ele.is_tryangle_finished,
                                    finished_datetime: ele.finished_datetime,
                                    is_initial_tryangle: ele.is_initial_tryangle,
                                    tryangle_id: ele._id,
                                    plan_id: ele.plan_id,
                                    user_id: ele.user_id,
                                    parent_tryangle_id: ele.parent_tryangle_id,
                                    purchase_dateTime: ele.createdAt,
                                    updatedAt: ele.updatedAt,
                                    // payment_id: ele.payment_id,
                                    accepted_status: ele2.accepted_status,
                                    acceptedAt: ele2.acceptedAt,
                                    is_initial: ele2.is_initial,
                                    close_remain_time: close_remain_time,
                                    last_invited: ele.last_invited,
                                    gaveGift: gaveGift
                                }
                                child.push(childTryangleDetail);
                            }
                        })
                    }
                })
            }
        })
    })

    // child_tryangle.forEach(async (ele) => {
    // 	const parentTryan = await UserTrayangle.findById({_id: ele.parent_tryangle_id});    	 
    //     InvitedUsers.find({ tryangle_id: ele.parent_tryangle_id, accepted_status: 1, user_id: ele.user_id }).then(data => {
    //         let c = 0;
    //         data.forEach(async (element) => {
    //         	console.log('element------->', element);
    //             const planDet = await Plan.findById({ _id: ele.plan_id });
    //             // if (parentTryan.is_closed === false)	{
    //              if (ele.is_tryangle_finished == true) {
    //              	// console.log('if------->', ele);
    //              	if (ele.finished_datetime < parentTryan.tryangle_close_dateTime)	{
    // 			// console.log('if-1------>', ele);
    //              		if (c == 0) {
    //                         gaveGift = planDet.plan_amount / 2;
    //                         c++;
    //                   }
    //                   else {
    //                       gaveGift = planDet.plan_amount
    //                   }  	
    //              	}
    //              }	
    //             // }

    //             var result = Math.abs(ele.createdAt - new Date()) / 1000;
    //             var close_remain_time = 14 - (Math.floor(result / 86400));
    //             let childTryangleDetail = {
    //                 isTryangleCreated: ele.isTryangleCreated,
    //                 is_closed: ele.is_closed,
    //                 is_manual_closed: ele.is_manual_closed,
    //                 is_tryangle_finished: ele.is_tryangle_finished,
    //                 finished_datetime: ele.finished_datetime,
    //                 is_initial_tryangle: ele.is_initial_tryangle,
    //                 tryangle_id: ele._id,
    //                 plan_id: ele.plan_id,
    //                 user_id: ele.user_id,
    //                 parent_tryangle_id: ele.parent_tryangle_id,
    //                 purchase_dateTime: ele.createdAt,
    //                 updatedAt: ele.updatedAt,
    //                 // payment_id: ele.payment_id,
    //                 accepted_status: element.accepted_status,
    //                 acceptedAt: element.acceptedAt,
    //                 is_initial: element.is_initial,
    //                 close_remain_time: close_remain_time,
    //                 last_invited: ele.last_invited,
    //                 gaveGift: gaveGift
    //             }
    //             child.push(childTryangleDetail);
    //             // console.log('child', child)
    //         });
    //     });
    // });

    const child_user_id = u.pluck(child_tryangle, 'user_id');
    const child_user_info = await User.find({ _id: { $in: child_user_id } }, { email: 1, first_name: 1, last_name: 1, profile_photo: 1 });
    childUserRes.push({ child_tryangle: child, child_user_info });
    const child_tryangle_id = u.pluck(child_tryangle, '_id');

    // const pendingSub = await InvitedUsers.find({ tryangle_id: { $in: child_tryangle_id }, accepted_status: 0 });
    // pendingSub.forEach(ele => {
    //     if (ele) {
    //         invitedOnly.push({
    //             is_initial: ele.is_initial,
    //             user_id: ele.user_id,
    //             email: ele.email,
    //             parent_id: ele.parent_id,
    //             parent_tryangle_id: ele.tryangle_id,
    //             accepted_status: ele.accepted_status,
    //             invitedAt: ele.createdAt,
    //             plan_id: ele.plan_id
    //         })
    //     }
    // })
    // const pending_sub_user = u.pluck(pendingSub, 'user_id');
    // const pending_sub_user_info = await User.find({ _id: pending_sub_user });
    // pending_sub_user_info.forEach(ele => {
    //     if (ele) {
    //         pending_userInfo.push({
    //             user_id: ele.user_id,
    //             email: ele.email,
    //             first_name: ele.first_name,
    //             last_name: ele.last_name,
    //             profile_photo: ele.profile_photo
    //         })
    //     }
    // })

    // console.log('invitedOnly', invitedOnly);
    pendingUser.push({ pending_user: invitedOnly, pending_user_info: pending_userInfo })

    var subchild = [];
    const sub_child_tryangle = await UserTrayangle.find({ parent_tryangle_id: { $in: child_tryangle_id }, isTryangleCreated: true });
    sub_child_tryangle.forEach(async (ele) => {
        await InvitedUsers.find({ tryangle_id: ele.parent_tryangle_id, accepted_status: { $eq: 1 }, user_id: ele.user_id }).then(data => {
            data.forEach(element => {
                var result = Math.abs(ele.createdAt - new Date()) / 1000;
                var close_remain_time = 14 - (Math.floor(result / 86400));
                let childTryangleDetail = {
                    isTryangleCreated: ele.isTryangleCreated,
                    is_closed: ele.is_closed,
                    is_manual_closed: ele.is_manual_closed,
                    is_tryangle_finished: ele.is_tryangle_finished,
                    is_initial_tryangle: ele.is_initial_tryangle,
                    finished_datetime: ele.finished_datetime,
                    tryangle_id: ele._id,
                    plan_id: ele.plan_id,
                    user_id: ele.user_id,
                    parent_tryangle_id: ele.parent_tryangle_id,
                    purchase_dateTime: ele.createdAt,
                    updatedAt: ele.updatedAt,
                    // payment_id: ele.payment_id,
                    accepted_status: element.accepted_status,
                    is_initial: element.is_initial,
                    acceptedAt: element.acceptedAt,
                    close_remain_time: close_remain_time,
                    last_invited: ele.last_invited,
                }
                subchild.push(childTryangleDetail);
            })
        })
    })

    const sub_child_user_id = u.pluck(sub_child_tryangle, 'user_id');
    const sub_child_user_info = await User.find({ _id: { $in: sub_child_user_id } }, { email: 1, first_name: 1, last_name: 1, profile_photo: 1 });
    subChildRes.push({ sub_child_tryangle: subchild, sub_child_user_info })
    res.status(200).send({ status: true, parentUserRes, parentTryangleRes: finalRes, plan_info, childUserRes, subChildRes, pendingUser });
});

router.post('/list_virtual_tryangle', verify, async (req, res) => {
    try {

        // show details of virtual tryanlge in slot of 3.
        // with total invited and plan amount

        const user_id = req.body.user_id;
        var parentUserRes = [];
        var parentTryangleRes = [];
        var childUserRes = [];
        var subChildRes = [];
        var invitedOnly = [];
        var plan_info = [];
        var finalRes = [];
        var pendingUser = [];
        var pending_userInfo = [];

        const user_info = await User.findById({ _id: user_id }, { email: 1, first_name: 1, last_name: 1, profile_photo: 1 });
        parentUserRes.push(user_info);
        const user_tryangles = await UserTrayangle.find({ user_id: user_id, isTryangleCreated: true, did_parent_accepted_tryangle: false });
        const user_parentTryangleIDs = u.pluck(user_tryangles, 'parent_tryangle_id');
        let user_parentTryangleID = [];
        user_parentTryangleIDs.forEach(ele => {
            if (ele != '') {
                user_parentTryangleID.push(ele);
            }
        })
        const parentTryangle = await UserTrayangle.find({ _id: { $in: user_parentTryangleID } });
        const parent_userId = u.pluck(parentTryangle, 'user_id');
        const parent_userInfo = await User.find({ _id: { $in: parent_userId } });

        user_tryangles.forEach(async (ele) => {
            var result = Math.abs(ele.createdAt - new Date()) / 1000;
            var close_remain_time = 14 - (Math.floor(result / 86400));
            let userTryangleDetail = {
                isTryangleCreated: ele.isTryangleCreated,
                is_closed: ele.is_closed,
                is_manual_closed: ele.is_manual_closed,
                is_tryangle_finished: ele.is_tryangle_finished,
                tryangle_id: ele._id,
                plan_id: ele.plan_id,
                user_id: ele.user_id,
                parent_tryangle_id: ele.parent_tryangle_id,
                purchase_dateTime: ele.createdAt,
                updatedAt: ele.updatedAt,
                close_remain_time: close_remain_time,
                last_invited: ele.last_invited,
            }
            parentTryangleRes.push(userTryangleDetail);
        });

        const user_tryangle_id = u.pluck(user_tryangles, '_id');

        var expected_earning = [];
        for (let i = 0; i < user_tryangles.length; i++) {
            const total_invited_by_tryangle = await InvitedUsers.find({ tryangle_id: user_tryangles[i]._id, accepted_status: 1 }).countDocuments();
            if (total_invited_by_tryangle > 0) {
                await Plan.findById({ _id: user_tryangles[i].plan_id }, { plan_amount: 1 }).then(data => {
                    expected_earning.push({
                        tryangle_id: user_tryangles[i]._id,
                        expected_earning_amount: ((data.plan_amount * (total_invited_by_tryangle - 1)) + (data.plan_amount / 2))
                    })
                });
            }
            else {
                expected_earning.push({
                    tryangle_id: user_tryangles[i]._id,
                    expected_earning_amount: 0
                })
            }
        }

        let parentInfo;
        for (let i = 0; i < parentTryangleRes.length; i++) {
            if (parentTryangleRes[i].tryangle_id === expected_earning[i].tryangle_id) {
                if (parentTryangleRes[i].parent_tryangle_id != '') {
                    for (let j = 0; j < parentTryangle.length; j++) {
                        if (parentTryangleRes[i].parent_tryangle_id == parentTryangle[j]._id) {
                            for (let k = 0; k < parent_userInfo.length; k++) {
                                if (parentTryangle[j].user_id == parent_userInfo[k]._id) {
                                    parentInfo = {
                                        user_id: parent_userInfo[k]._id,
                                        first_name: parent_userInfo[k].first_name,
                                        last_name: parent_userInfo[k].last_name,
                                        email: parent_userInfo[k].email,
                                        profile_photo: parent_userInfo[k].profile_photo
                                    }
                                }
                            }
                        }

                    }
                    finalRes.push({
                        isTryangleCreated: parentTryangleRes[i].isTryangleCreated,
                        is_closed: parentTryangleRes[i].is_closed,
                        is_manual_closed: parentTryangleRes[i].is_manual_closed,
                        is_tryangle_finished: parentTryangleRes[i].is_tryangle_finished,
                        tryangle_id: parentTryangleRes[i].tryangle_id,
                        plan_id: parentTryangleRes[i].plan_id,
                        user_id: parentTryangleRes[i].user_id,
                        parent_tryangle_id: parentTryangleRes[i].parent_tryangle_id,
                        purchase_dateTime: parentTryangleRes[i].purchase_dateTime,
                        updatedAt: parentTryangleRes[i].updatedAt,
                        close_remain_time: parentTryangleRes[i].close_remain_time,
                        last_invited: parentTryangleRes[i].last_invited,
                        expected_earning_amount: expected_earning[i].expected_earning_amount,
                        InvitedBy: parentInfo
                    })
                }
                else {
                    finalRes.push({
                        isTryangleCreated: parentTryangleRes[i].isTryangleCreated,
                        is_closed: parentTryangleRes[i].is_closed,
                        is_manual_closed: parentTryangleRes[i].is_manual_closed,
                        is_tryangle_finished: parentTryangleRes[i].is_tryangle_finished,
                        tryangle_id: parentTryangleRes[i].tryangle_id,
                        plan_id: parentTryangleRes[i].plan_id,
                        user_id: parentTryangleRes[i].user_id,
                        parent_tryangle_id: parentTryangleRes[i].parent_tryangle_id,
                        purchase_dateTime: parentTryangleRes[i].purchase_dateTime,
                        updatedAt: parentTryangleRes[i].updatedAt,
                        close_remain_time: parentTryangleRes[i].close_remain_time,
                        last_invited: parentTryangleRes[i].last_invited,
                        expected_earning_amount: expected_earning[i].expected_earning_amount,
                    })
                }

            }
        }

        const plan_ids = u.pluck(user_tryangles, 'plan_id');
        await Plan.distinct('_id', { _id: { $in: plan_ids } }).then((planDet) => {
            Plan.find({ _id: { $in: planDet } }).then((data) => {
                data.forEach(ele => {
                    let planDetail = {
                        plan_id: ele._id,
                        plan_title: ele.plan_title,
                        plan_description: ele.plan_description,
                        plan_amount: ele.plan_amount
                    }
                    plan_info.push(planDetail);
                })
            });
        });
        var child = [];
        const pending = await InvitedUsers.find({ tryangle_id: { $in: user_tryangle_id }, accepted_status: 0 });
        pending.forEach(ele => {
            if (ele) {
                invitedOnly.push({
                    is_initial: ele.is_initial,
                    user_id: ele.user_id,
                    email: ele.email,
                    parent_id: ele.parent_id,
                    parent_tryangle_id: ele.tryangle_id,
                    accepted_status: ele.accepted_status,
                    invitedAt: ele.createdAt,
                    plan_id: ele.plan_id
                })
            }
        })
        const pending_user = u.pluck(pending, 'user_id');
        const pending_user_info = await User.find({ _id: pending_user });
        pending_user_info.forEach(ele => {
            if (ele) {
                pending_userInfo.push({
                    user_id: ele.user_id,
                    email: ele.email,
                    first_name: ele.first_name,
                    last_name: ele.last_name,
                    profile_photo: ele.profile_photo
                })
            }
        })



        const child_tryangle = await UserTrayangle.find({ parent_tryangle_id: { $in: user_tryangle_id }, isTryangleCreated: true }).sort({ finished_datetime: 1 });
        const parentTryanIds = u.pluck(child_tryangle, 'parent_tryangle_id');
        const childUserIds = u.pluck(child_tryangle, 'user_id');
        const childPlanIds = u.pluck(child_tryangle, 'plan_id');
        const parentTryan = await UserTrayangle.find({ _id: { $in: parentTryanIds } });
        const invitedChild = await InvitedUsers.find({ tryangle_id: { $in: parentTryanIds }, accepted_status: 1, user_id: { $in: childUserIds } });
        const childPlan = await Plan.find({ _id: { $in: childPlanIds } });

        let c;
        let p;
        let testParent = [];
        child_tryangle.forEach(ele => {
            parentTryan.forEach(ele1 => {
                if (ele.parent_tryangle_id == ele1._id) {
                    invitedChild.forEach(ele2 => {
                        if (ele2.tryangle_id == ele.parent_tryangle_id && ele2.user_id == ele.user_id) {
                            let checkExist = testParent.includes(ele.parent_tryangle_id);
                            childPlan.forEach(ele3 => {
                                let gaveGift;
                                if (ele3._id == ele.plan_id) {
                                    if (ele.is_tryangle_finished == true) {
                                        if (ele1.tryangle_close_dateTime) {
                                            if (ele.finished_datetime < ele1.tryangle_close_dateTime) {
                                                if (checkExist == false) {
                                                    gaveGift = ele3.plan_amount / 2;
                                                    testParent.push(ele.parent_tryangle_id);
                                                }
                                                else {
                                                    gaveGift = ele3.plan_amount
                                                }
                                            }
                                        }
                                        else {
                                            if (checkExist == false) {
                                                gaveGift = ele3.plan_amount / 2;
                                                testParent.push(ele.parent_tryangle_id);
                                            }
                                            else {
                                                gaveGift = ele3.plan_amount
                                            }
                                        }
                                    }
                                    var result = Math.abs(ele.createdAt - new Date()) / 1000;
                                    var close_remain_time = 14 - (Math.floor(result / 86400));
                                    let childTryangleDetail = {
                                        isTryangleCreated: ele.isTryangleCreated,
                                        is_closed: ele.is_closed,
                                        is_manual_closed: ele.is_manual_closed,
                                        is_tryangle_finished: ele.is_tryangle_finished,
                                        finished_datetime: ele.finished_datetime,
                                        is_initial_tryangle: ele.is_initial_tryangle,
                                        tryangle_id: ele._id,
                                        plan_id: ele.plan_id,
                                        user_id: ele.user_id,
                                        parent_tryangle_id: ele.parent_tryangle_id,
                                        purchase_dateTime: ele.createdAt,
                                        updatedAt: ele.updatedAt,
                                        accepted_status: ele2.accepted_status,
                                        acceptedAt: ele2.acceptedAt,
                                        is_initial: ele2.is_initial,
                                        close_remain_time: close_remain_time,
                                        last_invited: ele.last_invited,
                                        gaveGift: gaveGift
                                    }
                                    child.push(childTryangleDetail);
                                }
                            })
                        }
                    })
                }
            })
        })

        const child_user_id = u.pluck(child_tryangle, 'user_id');
        const child_user_info = await User.find({ _id: { $in: child_user_id } }, { email: 1, first_name: 1, last_name: 1, profile_photo: 1 });
        childUserRes.push({ child_tryangle: child, child_user_info });
        const child_tryangle_id = u.pluck(child_tryangle, '_id');

        pendingUser.push({ pending_user: invitedOnly, pending_user_info: pending_userInfo })

        var subchild = [];
        const sub_child_tryangle = await UserTrayangle.find({ parent_tryangle_id: { $in: child_tryangle_id }, isTryangleCreated: true });
        sub_child_tryangle.forEach(async (ele) => {
            await InvitedUsers.find({ tryangle_id: ele.parent_tryangle_id, accepted_status: { $eq: 1 }, user_id: ele.user_id }).then(data => {
                data.forEach(element => {
                    var result = Math.abs(ele.createdAt - new Date()) / 1000;
                    var close_remain_time = 14 - (Math.floor(result / 86400));
                    let childTryangleDetail = {
                        isTryangleCreated: ele.isTryangleCreated,
                        is_closed: ele.is_closed,
                        is_manual_closed: ele.is_manual_closed,
                        is_tryangle_finished: ele.is_tryangle_finished,
                        is_initial_tryangle: ele.is_initial_tryangle,
                        finished_datetime: ele.finished_datetime,
                        tryangle_id: ele._id,
                        plan_id: ele.plan_id,
                        user_id: ele.user_id,
                        parent_tryangle_id: ele.parent_tryangle_id,
                        purchase_dateTime: ele.createdAt,
                        updatedAt: ele.updatedAt,

                        accepted_status: element.accepted_status,
                        is_initial: element.is_initial,
                        acceptedAt: element.acceptedAt,
                        close_remain_time: close_remain_time,
                        last_invited: ele.last_invited,
                    }
                    subchild.push(childTryangleDetail);
                })
            })
        })

        const sub_child_user_id = u.pluck(sub_child_tryangle, 'user_id');
        const sub_child_user_info = await User.find({ _id: { $in: sub_child_user_id } }, { email: 1, first_name: 1, last_name: 1, profile_photo: 1 });
        subChildRes.push({ sub_child_tryangle: subchild, sub_child_user_info })
        res.status(200).send({ status: true, parentUserRes, parentTryangleRes: finalRes, plan_info, childUserRes, subChildRes, pendingUser });
    }
    catch (err) {
        res.status(400).json({
            status: false,
            message: 'Something went wrong!',
            error: err.message
        })
    }
})

router.post('/join_virtual_trayngle', verify, async (req, res) => {
    try {
        const { tryangle_id } = req.body;
        console.log('user_id -----> ', tryangle_id);
        const userVirtualTryangle = await UserTrayangle.find({ parent_tryangle_id: tryangle_id, did_parent_accepted_tryangle: false }).sort({ tryangle_creation_datetime: 1 }).limit(3);
        console.log('userVirtualTryangle ------> ', userVirtualTryangle);
        const tryangleIds = u.pluck(userVirtualTryangle, '_id');
        console.log('tryangleIds ------> ', tryangleIds);
        await UserTrayangle.updateMany({ _id: { $in: tryangleIds } }, { $set: { did_parent_accepted_tryangle: true } });
        const updatedTryangle = await UserTrayangle.find({ _id: { $in: tryangleIds } });
        res.send(updatedTryangle);
    }
    catch (err) {
        res.status(400).json({
            status: false,
            message: 'Something went wrong.',
            error: err.message
        })
    }
})

router.post('/get_single_tryangle', verify, async (req, res) => {

    // show their child only
    // total invited for this tryangle, cash in - plan amount, expected out
    // after closed - total earned, cashin amount and earned amount
    // if joined and completed then when? datetime
    // if not joined then how many days are remaining
    // if not completed then count of joined subchild

    const tryangle_id = req.body.tryangle_id;

    let tryangle_detail = null;
    let total_invited = 0;
    let total_invitation_accepted = 0;
    let plan_amount = 0;
    let expected_amount = 0;
    let close_remain_time = null;
    let is_closed = null;
    let is_manual_closed = null;
    let child_list = [];
    let pending_invitation = [];
    let InvitedBy;

    try {
        tryangle_detail = await UserTrayangle.findById({ _id: tryangle_id });
    }
    catch (err) { }

    try {
        if (tryangle_detail.parent_tryangle_id != '' || tryangle_detail.parent_tryangle_id != null) {
            const parentTryangleInfo = await UserTrayangle.findById({ _id: tryangle_detail.parent_tryangle_id });
            const parentUserInfo = await User.findById({ _id: parentTryangleInfo.user_id });
            InvitedBy = {
                user_id: parentUserInfo._id,
                first_name: parentUserInfo.first_name,
                last_name: parentUserInfo.last_name,
                email: parentUserInfo.email,
                profile_photo: parentUserInfo.profile_photo
            }
        }
    }
    catch (err) { }
    // console.log('--->----tryangle_detail.user_id--->---', tryangle_detail.user_id);
    const parentDetail = await User.findById({ _id: tryangle_detail.user_id }, { first_name: 1, last_name: 1, profile_photo: 1, email: 1 })

    if (tryangle_detail !== null) {
        total_invited = await InvitedUsers.find({ tryangle_id: tryangle_id, accepted_status: { $ne: 2 } }).countDocuments();
        total_invitation_accepted = await InvitedUsers.find({ tryangle_id: tryangle_id, accepted_status: 1 }).countDocuments();


        const total_pending = total_invited - total_invitation_accepted;

        // await UserTryangle.findByIdAndUpdate({_id : tryangle_id}, {$set : {last_activity: 'This tryangle will auto close in ' + close_remain_time + ' days.' }});

        await Plan.findOne({ _id: tryangle_detail.plan_id }).then(data => {
            plan_amount = data.plan_amount;
        });

        await UserTrayangle.findById({ _id: tryangle_id }).then(data => {
            is_closed = data.is_closed;
            is_manual_closed = data.is_manual_closed;
        })
        if (total_invitation_accepted > 0) {
            expected_amount = (plan_amount * (total_invitation_accepted - 1) + (plan_amount / 2))
        }
        else {
            expected_amount = 0
        }

        var result;
        if (tryangle_detail.is_one_joined == true) {
            result = Math.abs(tryangle_detail.one_joined_at - new Date()) / 1000;
            close_remain_time = parseInt(tryangle_detail.auto_close_in) - (Math.floor(result / 86400));
            if (close_remain_time < 0) {
                close_remain_time = 'Closed';
            }
        }

        const getChildList = await InvitedUsers.find({ tryangle_id: tryangle_id, accepted_status: 1 }, { user_id: 1, acceptedAt: 1 });
        const invitation_ids = u.pluck(getChildList, '_id');
        const user_ids = u.pluck(getChildList, 'user_id');
        const user_info = await User.find({ _id: { $in: user_ids } }, { first_name: 1, profile_photo: 1, email: 1 });
        const join_date = await InvitedUsers.find({ _id: { $in: invitation_ids } }, { acceptedAt: 1, user_id: 1, is_initial: 1 });
        const is_tryangle_finished = await UserTrayangle.find({ parent_tryangle_id: tryangle_id }).sort({ finished_datetime: 1 })


        let c = 0;
        for (let i = 0; i < user_info.length; i++) {
            for (let j = 0; j < join_date.length; j++) {
                if (user_info[i]._id == join_date[j].user_id) {
                    for (let k = 0; k < is_tryangle_finished.length; k++) {
                        if (user_info[i]._id == is_tryangle_finished[k].user_id) {
                            let gaveGift;
                            // if (tryangle_detail.is_closed === false)	{
                            if (is_tryangle_finished[k].is_tryangle_finished === true) {
                                if (tryangle_detail.tryangle_close_dateTime) {
                                    if (is_tryangle_finished[k].finished_datetime < tryangle_detail.tryangle_close_dateTime) {
                                        if (c == 0) {
                                            gaveGift = plan_amount / 2;
                                            c++;
                                        }
                                        else {
                                            gaveGift = plan_amount
                                        }
                                    }
                                }
                                else {
                                    if (c == 0) {
                                        gaveGift = plan_amount / 2;
                                        c++;
                                    }
                                    else {
                                        gaveGift = plan_amount
                                    }
                                }
                            }
                            // }
                            child_list.push({
                                user_id: user_info[i]._id,
                                user_name: user_info[i].first_name,
                                email: user_info[i].email,
                                profile_photo: user_info[i].profile_photo,
                                acceptedAt: join_date[j].acceptedAt,
                                is_initial: join_date[j].is_initial,
                                is_tryangle_finished: is_tryangle_finished[k].is_tryangle_finished,
                                finished_datetime: is_tryangle_finished[k].finished_datetime,
                                close_datetime: is_tryangle_finished[k].tryangle_close_dateTime,
                                gaveGift: gaveGift
                            })
                        }
                    }
                }
            }
        }

        const getPendingList = await InvitedUsers.find({ tryangle_id: tryangle_id, accepted_status: 0 }, {});
        const pending_invitation_ids = u.pluck(getPendingList, '_id');
        const invited_date = await InvitedUsers.find({ _id: { $in: pending_invitation_ids }, tryangle_id: tryangle_id }, { createdAt: 1, user_id: 1, email: 1 });
        const pending_user_ids = u.pluck(getPendingList, 'user_id');
        const pending_user_info = await User.find({ _id: { $in: pending_user_ids } }, { first_name: 1, profile_photo: 1, email: 1 });
        let is_registered = [];
        const user = await InvitedUsers.find({ tryangle_id: tryangle_id, accepted_status: 0 });
        user.forEach(ele => {
            if (ele.user_id !== null) {
                is_registered.push({ 'user_id': ele.user_id, 'email': ele.email, 'is_registered': true });
            }
            else {
                is_registered.push({ 'user_id': ele.user_id, 'email': ele.email, 'is_registered': false });
            }
        })

        for (let i = 0; i < is_registered.length; i++) {
            for (let j = 0; j < invited_date.length; j++) {
                if (is_registered[i].is_registered === false && invited_date[j].email === is_registered[i].email) {
                    pending_invitation.push({
                        email: is_registered[i].email,
                        invitedAt: invited_date[i].createdAt,
                        is_registered: is_registered[i].is_registered
                    })
                }
            }
        }

        for (let i = 0; i < pending_user_info.length; i++) {
            if (pending_user_info[i]._id == invited_date[i].user_id) {
                if (pending_user_info[i]._id == is_registered[i].user_id) {
                    pending_invitation.push({
                        user_id: pending_user_info[i]._id,
                        user_name: pending_user_info[i].first_name,
                        profile_photo: pending_user_info[i].profile_photo,
                        email: pending_user_info[i].email,
                        invitedAt: invited_date[i].createdAt,
                    })
                }
            }
        }

        let data = {
            parentDetail: parentDetail,
            total_invited: total_invited,
            total_invitation_accepted: total_invitation_accepted,
            plan_amount: plan_amount,
            is_closed: is_closed,
            is_manual_closed: is_manual_closed,
            expected_amount: expected_amount,
            is_one_joined: tryangle_detail.is_one_joined,
            close_remain_time: close_remain_time,
            purchase_dateTime: tryangle_detail.createdAt,
            InvitedBy: InvitedBy,
            child_list: child_list,
            pending_invitation: pending_invitation,
            tryangle_close_dateTime: tryangle_detail.tryangle_close_dateTime,
            last_activity: tryangle_detail.last_activity,
            auto_close_in: tryangle_detail.auto_close_in,
            finished_datetime: tryangle_detail.finished_datetime
        }
        res.status(200).json({ status: true, data: data });
    }
    else {
        res.status(401).json({ status: false, message: 'Invalid tryangle ID' });
    }
});

router.post('/tryangle_manual_close', verify, async (req, res) => {
    const tryangle_id = req.body.tryangle_id;
    let tryangle_user_id = null;
    let tryangle_plan_id = null;
    let earning_child = 0;
    let actual_earning = 0;
    let success;

    await UserTrayangle.findById({ _id: tryangle_id }).then(async (data) => {
        tryangle_user_id = data.user_id;
        tryangle_plan_id = data.plan_id;

        if (data.is_closed === true) {
            res.status(401).send({ status: false, message: 'Tryangle has already been closed' });
        }
        else {
            await UserTrayangle.findByIdAndUpdate({ _id: tryangle_id }, { $set: { is_closed: true, is_manual_closed: true, tryangle_close_dateTime: new Date() } })
                .then(() => {
                    success = true;
                    // res.status(200).send({ status: true, message: 'You have closed your tryangle' });
                })
                .catch(err => {
                    success = false;
                    // res.status(401).send({ status: false, message: 'something Went Wrong!!' + err });
                })
        }
    });

    const planDetail = await Plan.findById({ _id: tryangle_plan_id }, { plan_amount: 1 });
    const child_tryangle = await UserTrayangle.find({ parent_tryangle_id: tryangle_id });

    // console.log('child_tryangle', child_tryangle)
    for (let i = 0; i < child_tryangle.length; i++) {
        if (child_tryangle[i].is_tryangle_finished === true) {
            earning_child++;
        }
    }

    /* half of plan amount for only first user. */
    // console.log('earning_child', earning_child)
    if (earning_child > 0) {
        if (earning_child === 1) {
            actual_earning = (planDetail.plan_amount / 2);
        }
        else if (earning_child > 1) {
            actual_earning = (((planDetail.plan_amount / 2) + (planDetail.plan_amount * (earning_child - 1))));
        }
    }

    const maintenance_fee = await MaintenanceFee.findOne({}).sort({ createdAt: -1 });

    const fee_amount = ((actual_earning * maintenance_fee.maintenance_fee) / 100);

    actual_earning = actual_earning - fee_amount;

    const user = await UserWallet.findOne({ user_id: tryangle_user_id });
    const userFund = parseFloat(user.fund) + parseFloat(actual_earning);
    const earning_uptillNow = parseFloat(user.earning_uptillNow) + parseFloat(actual_earning);

    await UserWallet.findByIdAndUpdate({ _id: user._id }, { $set: { fund: userFund, earning_uptillNow: earning_uptillNow } });
    // console.log('actual_earning', actual_earning)

    let userPayment = new UserPayment({
        user_id: tryangle_user_id,
        plan_id: tryangle_plan_id,
        plan_amount: planDetail.plan_amount,
        description: 'Earning',
        transaction_amount: actual_earning,
        transaction_tax: fee_amount,
        tryangle_id: tryangle_id
    })
    await userPayment.save();

    if (success) {
        res.status(200).send({ status: true, message: 'You have closed your tryangle', amount: actual_earning });
    } else {
        res.status(401).send({ status: false, message: 'something Went Wrong!!' });
    }

    const notificationData = await PushNotification.find({ user_id: tryangle_user_id }, { registrationToken: 1, platform: 1 });
    notificationData.forEach(ele => {
        if (ele.platform == 'android') {
            var payload = {
                notification: {
                    title: "Tryangle Closing",
                    body: "You have close your tryangle."
                }
            };
            sendNotification(ele.registrationToken, payload)
        }
        else if (ele.platform == 'ios') {
            let notification = new apn.Notification({
                alert: {
                    title: "Tryangle Closing",
                    body: "You have close your tryangle."
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

    const userEmail = await User.findById({ _id: tryangle_user_id })

    var subject = 'Tryangle Closing';
    var htmlText = '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '  <title>Tryangle Closing</title>' +
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
        '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Congratulations ' + userEmail.first_name + '. Your $' + planDetail.plan_amount + ' Tryangle just closed out at an amazing $' + actual_earning + '. Click below to see your wallet balance.</p>' +
        '<span style="background-color: #9B51E0;' +
        '                  text-decoration: none;' +
        '                  display: inline-block;' +
        '                  color: #fff;' +
        '                  font-family: Rubik, sans-serif;' +
        '                  font-size: 14px;' +
        '                  padding: 8px 15px;' +
        '                  border-radius: 10px;">' +
        // '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=wallet/id65266">Check link</a>' +
        '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=wallet/" style="text-decoration: none;color:#fff">MY WALLET</a>' +
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
    // var htmlText = 'Congratulations ' + userEmail.first_name + '. Your $' + planDetail.plan_amount + ' Tryangle just closed out at an amazing $' + actual_earning + '. Click below to see your wallet balance. <a href"tryangle://wallet/">[ MY WALLET ]</a>'
    // var htmlText = 'Your tryangle is closed now..';
    var toMail = userEmail.email;
    sendMail(toMail, subject, htmlText);
})

router.post('/sendEmail', function (req, res) {
    var subject = 'Tryangle Closing';
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
        '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=detail/:5fc7d09d8d4ae5433d2ea3de">MY WALLET</a>' +
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


    // var toMail = 'akashsoni1009@gmail.com';
    var toMail = 'rockys4948@gmail.com';
    // var toMail = 'sandylad66@gmail.com';
    sendMail(toMail, subject, htmlText);
})

router.post('/list_tryangle_detail', async (req, res) => {
    const plan_id = req.body.plan_id;
    var merge = [];

    if (plan_id) {
        var InvitedUser = await InvitedUsers.find({ plan_id: plan_id, accepted_status: 1 }, { email: 1, createdAt: 1, updatedAt: 1 }).sort({ email: 1 });
        var IUser = await u.pluck(InvitedUser, 'email');
        var user = await User.find({ email: { $in: IUser } }, { email: 1, first_name: 1, last_name: 1, profile_photo: 1 }).sort({ email: 1 });
        for (let i = 0; i < InvitedUser.length; i++) {
            for (let j = 0; j < user.length; j++) {
                if (InvitedUser[i] !== undefined && user[j] !== undefined) {
                    if (InvitedUser[i].email === user[j].email) {
                        merge.push({ 'email': InvitedUser[i].email, 'first_name': user[j].first_name, 'last_name': user[j].last_name, 'invitedAt': InvitedUser[i].createdAt, 'acceptedAt': InvitedUser[i].updatedAt, 'profile_photo': user[j].profile_photo })
                    }
                }
            }
        }
        if (merge.length === 0) {
            res.status(200).json({ status: true, message: 'No user are registered for this invitation plan' });
        }
        else {
            res.status(200).json({ status: true, data: merge });
        }
    }
    else {
        res.status(400).json({ status: false, message: 'plan_id is required field' });
    }
});

router.get('/filterAutoclose', verify, async (req, res) => {
    const totalData = await AutoClose.find({}).countDocuments();
    await AutoClose.find().skip(parseInt(req.body.start)).limit(parseInt(req.body.length)).sort({ createdAt: -1 })
        .then(autoclose => {
            res.status(200).send({ status: true, data: autoclose, length: totalData });
        })
})

router.get('/filterMaintenance', verify, async (req, res) => {
    const totalData = await MaintenanceFee.find({}).countDocuments();
    await MaintenanceFee.find().skip(parseInt(req.body.start)).limit(parseInt(req.body.length)).sort({ createdAt: -1 })
        .then(maintenance_fee => {
            res.status(200).send({ status: true, data: maintenance_fee, length: totalData });
        })
})


cron.schedule('1 */13 * * *', async () => {
    // router.get('/tryangle_auto_close', async (req, res) => {
    let tryangle_id = [];
    await UserTrayangle.find({}).then(tryangles => {
        tryangles.forEach(async (ele) => {
            const planData = await Plan.findById({ _id: ele.plan_id });
            const userDetail = await User.findById({ _id: ele.user_id });
            if (ele.is_closed === false) {
                const auto_close_days = await UserTrayangle.findById({ _id: ele._id });
                const days = parseInt(auto_close_days.auto_close_in);
                if (ele.is_one_joined == true) {

                    var result = Math.abs(ele.one_joined_at - new Date()) / 1000;
                    var close_remain_time = days - (Math.floor(result / 86400));
                    // var close_remain_time = 3 - (Math.floor(result / 86400)); //make it 14 - ()
                    if (close_remain_time === 2) {
                        const notificationData = await PushNotification.find({ user_id: ele.user_id }, { registrationToken: 1, platform: 1 });
                        notificationData.forEach(data => {
                            if (data.platform == 'android') {
                                var payload = {
                                    notification: {
                                        title: "Tryangle Closing",
                                        body: "Your tryangle will be close in two days."
                                    }
                                };
                                sendNotification(data.registrationToken, payload)
                            }
                            else if (data.platform == 'ios') {
                                let notification = new apn.Notification({
                                    alert: {
                                        title: "Tryangle Closing",
                                        body: "Your tryangle will be close in two days."
                                    },
                                    topic: 'com. .tryangle',
                                    payload: {
                                        "sender": "node-apn",
                                    },
                                    pushType: 'background'
                                });

                                apnProvider.send(notification, data.registrationToken)
                            }
                        })

                        var subject = 'Tryangle Closing';
                        var htmlText = '<!DOCTYPE html>' +
                            '<html>' +
                            '<head>' +
                            '  <title>Tryangle Closing</title>' +
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
                            '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Hey ' + userDetail.first_name + '. It looks like your $' + planData.plan_amount + ' Tryangle is about to close. Just two more days to go out of the original 14 days. Click below to invite even more people and multiply your money even more before this window closes.</p>' +
                            '<span style="background-color: #9B51E0;' +
                            '                  text-decoration: none;' +
                            '                  display: inline-block;' +
                            '                  color: #fff;' +
                            '                  font-family: Rubik, sans-serif;' +
                            '                  font-size: 14px;' +
                            '                  padding: 8px 15px;' +
                            '                  border-radius: 10px;">' +
                            '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=detail/' + ele._id + '" style="text-decoration: none;color:#fff">GROW MY TRYANGLE</a>' +
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
                        // var htmlText = 'Hey ' + userDetail.first_name + '. It looks like your $' + planData.plan_amount + ' Tryangle is about to close. Just two more days to go out of the original 14 days. Click below to invite even more people and multiply your money even more before this window closes. <a href="tryangle://detail/' + ele._id + '">[ GROW MY TRYANGLE ]</a>';
                        // var htmlText = 'Your tryangle will be close in two days.';
                        var toMail = userDetail.email;
                        sendMail(toMail, subject, htmlText);
                    }

                    if (close_remain_time === 0) {
                        await UserTrayangle.findByIdAndUpdate({ _id: ele._id }, { $set: { is_closed: true, tryangle_close_dateTime: new Date() } })
                        tryangle_id.push({
                            _id: ele._id
                        })
                        let tryangle_user_id = ele.user_id;
                        let tryangle_plan_id = ele.plan_id;
                        let earning_child = 0;
                        let actual_earning = 0;

                        const planDetail = await Plan.findById({ _id: tryangle_plan_id }, { plan_amount: 1 });
                        const child_tryangle = await UserTrayangle.find({ parent_tryangle_id: ele._id });



                        for (let i = 0; i < child_tryangle.length; i++) {
                            if (child_tryangle[i].is_tryangle_finished === true) {
                                earning_child++;
                            }
                        }
                        if (earning_child > 0) {
                            if (earning_child === 1) {
                                actual_earning = (planDetail.plan_amount / 2);
                            }
                            else if (earning_child > 1) {
                                actual_earning = (((planDetail.plan_amount / 2) + (planDetail.plan_amount * (earning_child - 1))));
                            }
                        }

                        const maintenance_fee = await MaintenanceFee.findOne({}).sort({ createdAt: -1 });
                        const fee_amount = ((actual_earning * maintenance_fee.maintenance_fee) / 100);
                        actual_earning = actual_earning - fee_amount;

                        let userPayment = new UserPayment({
                            user_id: tryangle_user_id,
                            plan_id: tryangle_plan_id,
                            plan_amount: planDetail.plan_amount,
                            description: 'Earning',
                            transaction_amount: actual_earning,
                            transaction_tax: fee_amount,
                            tryangle_id: ele._id
                        })
                        await userPayment.save();

                        var user = await UserWallet.findOne({ user_id: ele.user_id });
                        var userFund = parseFloat(user.fund) + parseFloat(actual_earning);
                        const earning_uptillNow = parseFloat(user.earning_uptillNow) + parseFloat(actual_earning);
                        await UserWallet.findByIdAndUpdate({ _id: user._id }, { $set: { fund: userFund, earning_uptillNow: earning_uptillNow } });

                        const notificationData = await PushNotification.find({ user_id: tryangle_user_id }, { registrationToken: 1, platform: 1 });
                        notificationData.forEach(data => {
                            if (data.platform == 'android') {
                                var payload = {
                                    notification: {
                                        title: "Tryangle Closing",
                                        body: "Your tryangle is closed now.."
                                    }
                                };
                                sendNotification(data.registrationToken, payload)
                            }
                            else if (data.platform == 'ios') {
                                let notification = new apn.Notification({
                                    alert: {
                                        title: "Tryangle Closing",
                                        body: "Your tryangle is closed now.."
                                    },
                                    topic: 'com. .tryangle',
                                    payload: {
                                        "sender": "node-apn",
                                    },
                                    pushType: 'background'
                                });

                                apnProvider.send(notification, data.registrationToken)
                            }
                        })
                        // const userEmail = await User.findById({ _id: tryangle_user_id })
                        var subject = 'Tryangle Closing';
                        var htmlText = '<!DOCTYPE html>' +
                            '<html>' +
                            '<head>' +
                            '  <title>Tryangle Closing</title>' +
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
                            '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">Congratulations ' + userDetail.first_name + '. Your $' + planData.plan_amount + ' Tryangle just closed out at an amazing $' + actual_earning + '. Click below to see your wallet balance. </p>' +
                            '<span style="background-color: #9B51E0;' +
                            '                  text-decoration: none;' +
                            '                  display: inline-block;' +
                            '                  color: #fff;' +
                            '                  font-family: Rubik, sans-serif;' +
                            '                  font-size: 14px;' +
                            '                  padding: 8px 15px;' +
                            '                  border-radius: 10px;">' +

                            '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=wallet/" style="text-decoration: none;color:#fff">MY WALLET</a>' +
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
                        // var htmlText = 'Congratulations ' + userDetail.first_name + '. Your $' + planData.plan_amount + ' Tryangle just closed out at an amazing $' + actual_earning + '. Click below to see your wallet balance. <a href="tryangle://wallet/">[ MY WALLET ]</a>'
                        // var htmlText = 'Your tryangle is closed now..';
                        var toMail = userDetail.email;
                        sendMail(toMail, subject, htmlText);
                    }
                }
            }

            // var result1 = Math.abs(ele.tryangle_creation_datetime - new Date()) / 1000;
            // const last_invited = 14 - (Math.floor(result1 / 86400));
            var result1 = Math.abs(ele.last_invited - new Date()) / 1000;
            const last_invited = (Math.floor(result1 / 86400));

            if (last_invited === 3) { //make it last_invited === 3
                const notificationData = await PushNotification.find({ user_id: ele.user_id }, { registrationToken: 1, platform: 1 });
                notificationData.forEach(async (data) => {
                    if (data.platform == 'android') {
                        var payload = {
                            notification: {
                                title: "Tryangle Inactivity",
                                body: "You have not invited anyone in past 3 days."
                            }
                        };
                        sendNotification(data.registrationToken, payload)
                    }
                    else if (data.platform == 'ios') {
                        let notification = new apn.Notification({
                            alert: {
                                title: "Tryangle Inactivity",
                                body: "You have not invited anyone in past 3 days."
                            },
                            topic: 'com. .tryangle',
                            payload: {
                                "sender": "node-apn",
                            },
                            pushType: 'background'
                        });

                        apnProvider.send(notification, data.registrationToken)
                    }

                    const userDetail = await User.findById({ _id: data.user_id })
                    var subject = 'Tryangle Inactivity';
                    var htmlText = '<!DOCTYPE html>' +
                        '<html>' +
                        '<head>' +
                        '  <title>Tryangle Inactivity</title>' +
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
                        // '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">' + userDetail.first_name + ', you okay? There’s been no activity on your recent $' + planData.plan_amount + ' Tryangle. We were a bit concerned. You’ve already done the heavy lifting of giving, now it just boils down to inviting. Invite a few more folks or remind your old friends. Click below to get it going again. <a href="tryangle://detail/:' + ele._id + '">[ GROW MY TRYANGLE ]</a></p>' +
                        '     <p style="font-family: Rubik, sans-serif;line-height: 24px;margin-top: 10px;color: #4F5A68;margin-bottom: 15px;">' + userDetail.first_name + ', you okay? There’s been no activity on your recent $' + planData.plan_amount + ' Tryangle. We were a bit concerned. You’ve already done the heavy lifting of giving, now it just boils down to inviting. Invite a few more folks or remind your old friends. Click below to get it going again.</p>' +
                        '<span style="background-color: #9B51E0;' +
                        '                  text-decoration: none;' +
                        '                  display: inline-block;' +
                        '                  color: #fff;' +
                        '                  font-family: Rubik, sans-serif;' +
                        '                  font-size: 14px;' +
                        '                  padding: 8px 15px;' +
                        '                  border-radius: 10px;">' +
                        '     <a href="' + config.myIP + '/api/check/emailDeepLinkCheck?app=tryangle&dest=detail/' + ele._id + '" style="text-decoration: none;color:#fff">GROW MY TRYANGLE</a>' +
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
                    // var htmlText = userDetail.first_name + ', you okay? There’s been no activity on your recent $' + planData.plan_amount + ' Tryangle. We were a bit concerned. You’ve already done the heavy lifting of giving, now it just boils down to inviting. Invite a few more folks or remind your old friends. Click below to get it going again. <a href="tryangle://detail/:' + ele._id + '">[ GROW MY TRYANGLE ]</a>';
                    // var htmlText = 'You have not invited anyone in past 3 days.';
                    var toMail = userDetail.email;
                    sendMail(toMail, subject, htmlText);
                })
            }
        })
    })
    await UserTrayangle.updateMany({ _id: { $in: tryangle_id } }, { $set: { is_closed: true } });
    // })
});

module.exports = router;