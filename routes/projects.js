const router = require('express').Router();
const verify = require('./verifyToken')
var multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const mime = require('mime');
let Project = require('../models/project.model');
const { response } = require('express');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + file.originalname)
    }
})

var upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
            req.fileValidationError = 'Only image files are allowed!';
            return cb(new Error('Only image(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF) files are allowed!'), false);
        }
        cb(null, true);
    }
});

router.get('/createproject', verify, async (req, res, next) => {

    console.log('-->-- req.body -->--', req.body);
    var title = req.body.title;
    var secondarytitle = req.body.secondarytitle;
    var description = req.body.description;
    var video_unique_id = req.body.video_id;
    var website_url = req.body.website_url;
    // var logoName = req.body.logo;
    // var backName = req.body.image;
    var logobase64 = req.body.logo;
    var logoImage = JSON.parse(logobase64);
    var imagebase64 = req.body.image;
    var backImage = JSON.parse(imagebase64);

    var number = Math.random();
    number.toString(36);
    var uniqueId = number.toString(36).substr(2, 9);

    var logoName = Date.now() + '_' + uniqueId + '.png';
    const logopath = path.join(__dirname, '../uploads/logo/' + logoName);

    var number = Math.random();
    number.toString(36);
    var uniqueId = number.toString(36).substr(2, 9);

    var backName = Date.now() + '_' + uniqueId + '.png';
    const backpath = path.join(__dirname, '../uploads/background_image/' + backName);

    const logobase64Data = logoImage.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const imagebase64Data = backImage.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    try {
        fs.writeFileSync(logopath, logobase64Data, { encoding: 'base64' });
        fs.writeFileSync(backpath, imagebase64Data, { encoding: 'base64' });
    } catch (error) {
        console.error(error);
    }

    const newProject = await new Project({ title, secondarytitle, description, logoName, video_unique_id, website_url, backName });
    await newProject.save()
        .then((newProject) => res.status(200).json({ status: true, data: newProject }))
        .catch(err => res.status(400).json('Error: ' + err))
})

router.get('/:id', function (req, res) {
    Project.findById(req.params.id)
        .then(project => {
            console.log('-->-- project -->--', project);
            res.json(project)
        })
        .catch(err => res.status(400).json('Error: ' + err));
});

router.get('/', function (req, res) {
    console.log('projects listing');
    Project.find()
        .then(projects => {
            var data = { projects };
            res.json(data);
        }).catch(err => res.status(400).json('Error : ' + err))
});

router.post('/update_project', verify, async (req, res) => {
    var id = req.body.id;
    var title = req.body.title;
    var secondarytitle = req.body.title;
    var description = req.body.description;
    var video_unique_id = req.body.video_id;
    var website_url = req.body.website_url;
    const detail = await Project.findById(id);
    var logobase64 = req.body.logo;
    var imagebase64 = req.body.image;
    if (logobase64 != undefined && imagebase64 != undefined) {
        var logoImage = JSON.parse(logobase64);
        var backImage = JSON.parse(imagebase64);

        var number = Math.random();
        number.toString(36);
        var uniqueId = number.toString(36).substr(2, 9);

        var logoName = Date.now() + '_' + uniqueId + '.png';
        const logopath = path.join(__dirname, '../uploads/logo/' + logoName);

        var number = Math.random();
        number.toString(36);
        var uniqueId = number.toString(36).substr(2, 9);

        var backName = Date.now() + '_' + uniqueId + '.png';
        const backpath = path.join(__dirname, '../uploads/background_image/' + backName);

        const logobase64Data = logoImage.replace(/^data:([A-Za-z-+/]+);base64,/, '');
        const imagebase64Data = backImage.replace(/^data:([A-Za-z-+/]+);base64,/, '');
        try {
            fs.writeFileSync(logopath, logobase64Data, { encoding: 'base64' });
            fs.writeFileSync(backpath, imagebase64Data, { encoding: 'base64' });
        } catch (error) {
            console.error(error);
        }
    }
    else if (logobase64 != undefined) {
        var logoImage = JSON.parse(logobase64);
        var number = Math.random();
        number.toString(36);
        var uniqueId = number.toString(36).substr(2, 9);

        var logoName = Date.now() + '_' + uniqueId + '.png';
        var backName = detail.backName;
        const logopath = path.join(__dirname, '../uploads/logo/' + logoName);
        const logobase64Data = logoImage.replace(/^data:([A-Za-z-+/]+);base64,/, '');
        try {
            fs.writeFileSync(logopath, logobase64Data, { encoding: 'base64' });
        } catch (error) {
            console.error(error);
        }
    }
    else if (imagebase64 != undefined) {
        var backImage = JSON.parse(imagebase64);
        var number = Math.random();
        number.toString(36);
        var uniqueId = number.toString(36).substr(2, 9);

        var backName = Date.now() + '_' + uniqueId + '.png';
        var logoName = detail.logoName;
        const backpath = path.join(__dirname, '../uploads/background_image/' + backName);
        const imagebase64Data = backImage.replace(/^data:([A-Za-z-+/]+);base64,/, '');

        try {
            fs.writeFileSync(backpath, imagebase64Data, { encoding: 'base64' });
        } catch (error) {
            console.error(error);
        }
    }
    else {
        var backName = detail.backName;
        var logoName = detail.logoName;
    }
    await Project.findOneAndUpdate({ _id: id },
        {
            $set: {
                title: title,
                secondarytitle: secondarytitle,
                description: description,
                logoName: logoName,
                video_unique_id: video_unique_id,
                website_url: website_url,
                backName: backName
            }
        });
    res.status(200).json({ status: true, message: 'Project updated' });
});


router.post('/deleteProject/:id', function (req, res) {
    Project.deleteOne({ _id: req.params.id })
        .then(project => {
            res.json(project)
        })
        .catch(err => res.status(400).json('Error: ' + err));
});

router.post('/filterProject', async (req, res) => {

    const totalData = await Project.find({}).countDocuments();
    await Project.find().skip(parseInt(req.body.start)).limit(parseInt(req.body.length)).sort({ createdAt: -1 })
        .then(projects => {
            res.status(200).send({ status: true, data: projects, length: totalData });
        })
})

// router.post('/filterProject', function (req, res) {
//     const totalData = Project.find({}).countDocuments();
//     console.log(totalData);
//     Project.find().skip(parseInt(req.body.start)).limit(parseInt(req.body.length))
//         .then(projects => {
//         	res.json({data: projects, length: totalData});
//         }).catch(err => res.status(400).json('Error : ' + err))
// });

router.post('/filterProject', async (req, res) => {

    const totalData = await Project.find({}).countDocuments();
    await Project.find().skip(parseInt(req.body.start)).limit(parseInt(req.body.length)).sort({ createdAt: -1 })
        .then(projects => {
            res.status(200).send({ status: true, data: projects, length: totalData });
        })
})

router.get('/get_videos', function (req, res) {
    Project.find({}, { video_unique_id: 1 })
        .then(video_id => {
            res.status(200).send({ status: true, data: video_id })
        })
});

router.post('/delete/:id', verify, function (req, res) {
    Project.findByIdAndDelete(req.params.id)
        .then(project => res.json('Project deleted'))
        .catch(err => res.status(400).json('Error: ' + err));
});

router.post('/update/:id', verify, upload.array('projectimage', 5), async (req, res, next) => {
    Project.findById(req.params.id)
        .then(project => {
            var fileinfo = req.files;
            var projectimages = '';
            if (fileinfo.length > 0) {
                for (var i = 0; i < fileinfo.length; i++) {
                    if (i === fileinfo.length - 1) {
                        projectimages += fileinfo[i].filename;
                    } else {
                        projectimages += fileinfo[i].filename + ', ';
                    }
                }
                project.projectimages = projectimages;
            }

            project.title = req.body.title;
            project.secondarytitle = req.body.secondarytitle;
            project.description = req.body.description;

            project.save()
                .then(() => res.json('Project updated!!!'))
                .catch(err => res.status(400).json('Error: ' + err))
        })
        .catch(err => res.status(400).json('Error: ' + err))
})

module.exports = router;
