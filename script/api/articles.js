const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs')
const multer = require('multer')
const path = require('path')

const Articles = require('./models/model_article');
const Rentals = require('./models/model_rental');

const auth = require('./auth');
const helper = require('../helper');


const articlesFullPath = path.join(global.rootDir, 'public/img/articlesImages/')

const stateDict = {
    "perfect": 5,
    "good": 4,
    "suitable": 3,
    "broken": 0,
    "unavailable": 0
}

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, articlesFullPath)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    },
})

async function deleteImg(img) {
    if (img !== null && img !== undefined && img!== "") {
        try {
            await fs.unlinkSync(path.join(articlesFullPath, path.basename(img)))
        } catch (err) {
            console.log('Error while removing image')
            console.log({ error: err })
        }
    }
}

const upload = multer({ storage: storage });

var router = express.Router();

router.get('/', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]), (req, res) => {
    const queryPassed = req.query
    const query = {}
    if(queryPassed.superCategory) query.superCategory = queryPassed.superCategory
    if(queryPassed.state) query.state = queryPassed.state
    if(queryPassed.maxPrice) query.price = {"$lt": queryPassed.maxPrice}
    if(queryPassed.minPrice) query.price = {...query.price, "$gt": queryPassed.minPrice}
    if(queryPassed.category) query.category = { '$in': queryPassed.category.split(',') }
    Articles.find(query)
    .exec().
    then(artcls => {
        res.status(200).json(artcls)
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
})

router.get('/suggested/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]), async (req, res) => {
    const id= req.params.id;
    const start = req.query.start;
    const end = req.query.end;
    let articles;
    await Articles.find()
    .exec().
    then(artcls => {
        articles = artcls;
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
    let primaryArt;
    await Articles.findById(id)
    .exec().
    then(art => {
        primaryArt = art;
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
    let toRet = null;
    let toSuperRet = null;
    for(let article of articles){
        if(article.state != "broken" && article.state != "unavailable" && article._id != primaryArt._id){
            if (article.category == primaryArt.category){
                let tmp = article
                tmp.estimated = await helper.estimate_price({id: article._id, start, end});
                if(toRet != null){
                    if(toRet.estimated.price > tmp.estimated.price)
                        if(await helper.checkAval(article._id, start, end))
                            toRet = tmp;
                }
                else{
                    if(await helper.checkAval(article._id, start, end))
                        toRet = tmp;
                }
            }
            else if(article.superCategory == primaryArt.superCategory){
                let tmp = article
                article.estimated = await helper.estimate_price({id: article._id, start, end});
                if(toSuperRet != null){
                    if(toSuperRet.estimated.price > tmp.estimated.price)
                        if(await helper.checkAval(article._id, start, end))
                            toSuperRet = tmp;
                }
                else{
                    if(await helper.checkAval(article._id, start, end))
                        toRet = tmp;
                }
            }
        }
    }
    if(toRet == null)
        res.status(200).json({alternative: toSuperRet});
    else
        res.status(200).json({alternative: toRet});
})

router.get('/category', (req, res) => {
    Articles.find()
    .exec().
    then(artcls => {
        let toRet  = [];
        let retCateg = [];
        for(let article of artcls){
            if(!(retCateg.includes(article.name))){
                if(article.state != "broken"){
                    retCateg.push(article.name);
                    toRet.push(article);
                }
            }
        }
        res.status(200).json(toRet)
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    })
})

router.post('/', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]),  upload.single('img'), async (req, res) => {
    let data = req.body;
    data._id = new mongoose.Types.ObjectId();
    data.img = req.file ? req.file.filename : ''
    const newArticle = new Articles(data);
    newArticle.save()
    .then(result => {
        res.status(200).json({
            message: "article created",
            article: newArticle
        })
    })
    .catch(err => {
        deleteImg(data.img)
        res.status(400).json({message: "Error in creating article", error: err})
    })
})

router.get('/availables', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]), async (req, res) => {
    const start = req.query.start
    const end = req.query.end
    let availables = []
    if (!Date.parse(start) || !Date.parse(end) || start > end){
        return res.status(400).json({message: 'Error. Bad request. Date start must be before end date'})
    } else {
        await Articles.find({ $and: [ {state: {$ne: 'broken'}}, {state: {$ne: 'unavailable'}} ]})
        .exec()
        .then(async articles => {
            for(const article of articles){
                if(await helper.checkAval(article._id, start, end))
                    availables.push(article._id)
            }
            return res.status(200).json({availables})
        })
        .catch(err => res.status(500).json({err: 'Error occured'}))
    }
})

router.get('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]),(req, res) => {
    const id = req.params.id;
    Articles.findOne({_id: id})
    .exec().
    then(artcl => {
        res.status(200).json(artcl)
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
})

router.delete('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), async (req, res) => {
    const id = req.params.id;
    await Articles.findOneAndDelete({_id: id})
    .exec()
    .then(result => {
        deleteImg(result.img)
        res.status(200).json({message: "Succesfully deleted", result: result})
    })
    .catch(err => res.status(500).json({message: "Error in delete", error: err}))
})


router.patch('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), upload.single('img'), async(req, res) => {
    const id = req.params.id;
    let delImg = false
    if(!id) return res.status(404).json({message: "Id missing"})   
    let newData = req.body
    if (req.file){
        delImg = true
        newData.img = req.file.filename
    } 
    let errorUpdating= false;
    await Articles.findOneAndUpdate(
        {_id: id},
        {$set: newData}
        )
        .exec()
        .then(async oldArticle => {
            if (delImg && newData.img !== null) {
                await deleteImg(oldArticle.img)
            }
            if(newData.state && newData.state != oldArticle.state){
                if(stateDict[newData.state] != 0 && stateDict[oldArticle.state] != 0){
                    if(stateDict[newData.state] < stateDict[oldArticle.state]){
                        errorUpdating = await helper.updateRentals(id, true);
                    } else {
                        errorUpdating = await helper.updateRentals(id, false);
                    }
                }
            }
            if(!errorUpdating)
                res.status(200).json({message: "Modify success (old article)", article: oldArticle})
            else
                res.status(400).json({message: "Error in updating rentals", article: oldArticle})
        })
        .catch(err => {
            res.status(401).json({message: "Modify error", error: err})
        })
})


router.get('/:id/rentals', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), async (req, res) => {
    const queryPassed = req.query
    const query = {}
    if (queryPassed.state) query.state = queryPassed.state
    if (queryPassed.date_start) query.date_start = queryPassed.date_start
    if (queryPassed.date_end) query.date_end = queryPassed.date_end
    const id = req.params.id;
    if(!id) return res.status(404).json({message: "Id missing"})
    await Rentals.find(
        {object_id : id, ...query})
        .exec()
        .then(rents => {
            res.status(200).json(rents)
        })
        .catch(err => res.status(400).json({message: "Error", error: err}))
})

router.get('/:id/available', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]), async (req, res) => {
    const id = req.params.id
    const start = req.query.start || Date.now();
    const end = req.query.end
    const user = (req.query.user) ? req.query.user : false
    const suggested = (req.query.suggest) ? req.query.suggest : false
    const currRent = (req.query.rental) ? req.query.rental : false
    let searchOpt = {}
    if(currRent) {
        searchOpt._id= {'$ne': currRent}
    }
    if (!Date.parse(start) || !Date.parse(end) || start > end){
        return res.status(401).json({message: 'Bad request. Start date must be before end date'})
    }
    if(!id) return res.status(406).json({message: "Id missing"})

    if(await helper.checkAval(id, start, end, searchOpt)){
        const priceToReturn = await helper.estimate_price({id, start, end, user, suggested})
        if(priceToReturn.err) return res.status(200).json({err: priceToReturn.err})
        res.status(200).json({available: true, estimated: priceToReturn})
    } else {
        res.status(200).json({available: false})
    }
})

module.exports = router;