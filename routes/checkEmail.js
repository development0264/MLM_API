const router = require('express').Router();

router.get('/emailDeepLinkCheck', function (req, res)  {
    res.sendFile('emailDeepLinkCheck.html', { root: 'deepLink_pages' });
});

router.get('/browserCheck', function (req, res)  {
    res.sendFile('browserCheck.html', { root: 'deepLink_pages' });
})

module.exports = router;