global.rootDir = __dirname ;

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser')
const routine = require('./script/routines')
routine.stopRoutines()
require('dotenv').config({ path: path.resolve(__dirname, './.env') });


const routerUser = require('./script/api/users');
const routerStaff = require('./script/api/staff');
const routerAuth = require('./script/api/auth');
const routerArticles = require('./script/api/articles');
const routerPaymentMethods = require('./script/api/paymentMethods.js');
const routerRentals = require('./script/api/rentals');
const routerCrusades = require('./script/api/crusades');
const history = require('connect-history-api-fallback')

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb', extended: true }))
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))


app.use('/api/users/', routerUser);
app.use('/api/staff/', routerStaff);
app.use('/api/auth/', routerAuth);
app.use('/api/articles/', routerArticles);
app.use('/api/paymentmethods/', routerPaymentMethods);
app.use('/api/rentals/', routerRentals);
app.use('/api/crusades/', routerCrusades);

const mongoCredentials = {
	user: process.env.DB_USER,
	pwd: process.env.DB_PASSWORD,
	site: process.env.DB_SITE
} 

const deploy = false

const port = 8000;
const db = mongoose.connection

const hostedMongo = `mongodb://${mongoCredentials.user}:${mongoCredentials.pwd}@${mongoCredentials.site}?writeConcern=majority`
const localMongo = `mongodb://localhost:27017/${process.env.DB_LOCAL}`

const monogURI = deploy ? hostedMongo : localMongo


mongoose.connect(monogURI, { useNewUrlParser: true, useUnifiedTopology: true})
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', function () {
    console.log('Connected to Mongo!')
})

app.use('/js'  , express.static(global.rootDir +'/public/js'));
app.use('/css' , express.static(global.rootDir +'/public/css'));
app.use('/data', express.static(global.rootDir +'/public/data'));
app.use('/docs', express.static(global.rootDir +'/public/html'));
app.use('/fonts', express.static(global.rootDir +'/public/fonts'));
app.use('/img' , express.static(global.rootDir +'/public/img'));
app.use('/home' , express.static(global.rootDir +'/public/front-office'));
app.use('/staff', express.static(global.rootDir +'/public/back-office'));

app.use(
    history({
        rewrites: [
            {
                from: /dashboard(\W|\w)*/,
                to: '/dashboard',
            },
            {
                from: /^\/api\/.*$/,
                to: function (context) {
                    return context.parsedUrl.path
                },
            },
            {
                from: /\/(\W|\w)*/,
                to: '/',
            },
        ],
        disableDotRule: false,
    })
)

app.get('/', (req, res) => {
    res.sendFile(
        global.rootDir + '/public/front-office/index.html'
    )
})

app.get('/staff', (req, res) => {
    res.sendFile(
        global.rootDir + '/public/back-office/index.html'
    )
})

app.get('/dashboard', (req, res) => {
    res.sendFile(
        global.rootDir + '/public/html/dashboard/index.html'
    )
})


app.listen(port, ()=>{
    console.log('listening on port '+port);
    routine.startRoutines()
});
