const mongoose = require('mongoose');
const express = require('express');

const Crusades = require('./models/model_crusade');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const auth = require('./auth');
const helper = require('../helper');

var router = express.Router();

router.get('/', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]), (req, res) => {
    Crusades.find()
    .exec().
    then(crsds => {
        res.status(200).json(crsds)
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    })
})

router.post('/', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), async (req, res) => {

    async function patcher(args){
        const {id, start, end} = {...args}
        const newData = {}
        if(start) newData.date_start = start
        if(end) newData.date_end = end
        await Crusades.findOneAndUpdate({_id:id}, {$set: newData})
        .exec()
        .then(() => {})
        .catch(() => {})
    }

    let data = req.body;
    const start = data.date_start
    const end = data.date_end
    if(!Date.parse(start) || !Date.parse(end) || start > end){
        res.status(400).json({ message: "Bad request"})
    }
    else{
        if(await helper.isCrusade(start, end))
            res.status(400).json({message: "Crociata già presente nelle date scelte"})
        else{
            let crusades = null
            
            await Crusades.find(
                {$or: [
                    { date_start: {$lte: start}, date_end: {$gte: start} },
                    { date_start: {$lte: end}, date_end: {$gte: end} }
                ]}
            ).exec().then(crs => crusades=crs).catch(()=>{})
            let crusadesIntersected = []
            for(let crusade of crusades){
                if(Date.parse(crusade.date_end) >= Date.parse(start) && Date.parse(crusade.date_start) <= Date.parse(start)){
                    await patcher({id: crusade._id, end: data.date_end})
                    crusadesIntersected[0] = crusade
                    // data.date_start = new Date(Date.parse(crusade.date_end) + 1000*60*60*24 ).toISOString().slice(0,10)
                }
                else {
                    await patcher({id: crusade._id, start: data.date_start})
                    crusadesIntersected[1] = crusade
                    // data.date_end = new Date(Date.parse(crusade.date_start) - 1000*60*60*24 ).toISOString().slice(0,10);
                }
            }
            if(crusadesIntersected[0] && crusadesIntersected[1]){
                await patcher({ id: crusadesIntersected[0]._id, end: crusadesIntersected[1].date_end})
                await Crusades.findOneAndDelete({ _id: crusadesIntersected[1]._id}).exec().then().catch()
                res.status(200).json({message: "Crociate modificate perchè già presenti"})
            }
            else if(crusadesIntersected.length === 0){
                data._id = new mongoose.Types.ObjectId();
                const newCrusade = new Crusades(data);
                newCrusade.save()
                .then(result => {
                    res.status(200).json({
                        message: "Crusade Created",
                        crusade: newCrusade
                    })
                })
                .catch(err => {
                    res.status(400).json({message: "Error in creating crusade", error: err})
                })
            }
            else {
                res.status(200).json({message: "Crociate modificate perchè già presenti"})
            }
        }
    }
})

router.delete('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), async (req, res) => {
    const id = req.params.id
    if(!id) return res.status(404).json({message: "Id missing"})
    await Crusades.findOneAndDelete({_id: id})
    .exec()
    .then(result => {
        res.status(200).json({message: "Successfully deleted", result: result})
    })
    .catch(err => res.status(500).json({message: "Error in delete", error: err}))
})

router.get('/today', async (req, res) => {
    const today = Date.parse(new Date().toISOString().slice(0, 10))
    let isToday = false;
    await Crusades.find()
    .exec()
    .then(result => {
        for(let crusade of result){
            const start = Date.parse(crusade.date_start)
            const end = Date.parse(crusade.date_end)
            if (start <= today && end >= today)
                isToday= true;
        }
        res.status(200).json({isCrusade: isToday})
    })
    .catch(err => {res.status(500).json({message: "Error in crusades", error: err});});
})

module.exports = router;