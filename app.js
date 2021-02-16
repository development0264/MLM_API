const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const bodyParser = require('body-parser');
require('dotenv').config();
const paypal = require('paypal-rest-sdk');
const https = require('https');
const http = require('http');
const fs = require('fs');

const app = express()

app.use(cors())
//app.use(express.json());
app.use(express.static(__dirname + '/'));

app.use(bodyParser.urlencoded({ extended: true, limit: '500mb', parameterLimit: 100000 }));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/*+json' }));
app.use(bodyParser.raw({ type: 'application/vnd.custom-type' }));
app.use(bodyParser.text({ type: 'text/html' }));
app.use(bodyParser.text({ type: 'text/plain' }));

// const uri = process.env.ATLAS_URI;
const uri = 'mongodb://localhost:27017/MLM_API'
mongoose.connect(uri, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, useFindAndModify: false });

const connection = mongoose.connection;
connection.once('open', () => {
  console.log('mongo connection successfully');
})

paypal.configure({
  'mode': 'sandbox',
  'client_id': process.env.PAYPAL_CLIENT_ID,
  'client_secret': process.env.PAYPAL_CLIENT_SECRET
});


var deeplink = require('node-deeplink');
app.get(
  '/deeplink',
  deeplink({
    fallback: '',
    android_package_name: '',
    ios_store_link:
      ''
  })
);

const usersRouter = require('./routes/users')
const postsRouter = require('./routes/posts')
const projectsRouter = require('./routes/projects')
const tryanglesRouter = require('./routes/tryangles')
const plansRouter = require('./routes/plans')
const invitationsRouter = require('./routes/invitedusers')
const checkRoute = require('./routes/checkEmail');

app.use('/api/users', usersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/posts', postsRouter);
app.use('/api/tryangle', tryanglesRouter);
app.use('/api/plan', plansRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/check', checkRoute);

const options = {
  key: fs.readFileSync(''),
  cert: fs.readFileSync('')
};

const httpServer = http.createServer(app);
const httpsServer = https.createServer(options, app);

httpServer.listen(5000, () => {
  console.log('server running on http 5000.');
});

httpsServer.listen(5050, () => {
  console.log('server running on https 5050.');
});

module.exports = app;