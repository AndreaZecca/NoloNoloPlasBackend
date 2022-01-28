const express = require('express');
const mongoose = require('mongoose');

const Rentals = require('./models/model_rental');
const Articles = require('./models/model_article')
const auth = require('./auth');
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json();
const helper = require('../helper');

var router = express.Router();

const articlePrice = {'perfect' : 1, 'good': 0.8, 'suitable' : 0.4, 'broken' : 0, 'unavailable': 0};

const stateDict = {
    "perfect": 5,
    "good": 4,
    "suitable": 3,
    "broken": 0,
    "unavailable": 0
}


router.get('/', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), (req, res) => {
    const queryPassed = req.query
    const query = {}
    let multiquery= {}
    if(queryPassed.state)
        multiquery = {'$in' : queryPassed.state.split(',')}
    if (queryPassed.state) query.state = multiquery
    if (queryPassed.date_start) query.date_start = queryPassed.date_start
    if (queryPassed.date_end) query.date_end = queryPassed.date_end
    Rentals.find(query)
    .exec().
    then(rntls => {
        res.status(200).json(rntls)
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
})

router.post('/', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]), async (req, res) => {
    let data = req.body;
    data._id = new mongoose.Types.ObjectId()
    const suggested = (req.query.suggest) ? req.query.suggest : false
    data.estimated = await helper.estimate_price({piece:data, user:data.userId, suggested})
    if(data.estimated.err){
        return res.status(400).json({message: "Error in creating rental", error: data.estimated.err})
    } else {
        const newRental = new Rentals(data)
        newRental.save()
        .then(result => {
            res.status(200).json({
                message: "rental created",
                rental: newRental
            })
        })
        .catch(err => {
            res.status(400).json({message: "Error in creating rental", error: err})
        })
    }
})

router.get('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]),(req, res) => {
    const id = req.params.id;
    Rentals.findOne({_id: id})
    .exec().
    then(rntl => {
        res.status(200).json(rntl)
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
})

router.delete('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]), async (req, res)=>{
    const id = req.params.id;
    let myRent = false;
    await Rentals.findById(id)
    .exec()
    .then(rent => {
        myRent= rent
    })
    .catch(err => res.status(500).json({message: "Rental not found", error: err}))
    suggestedRental = false;
    if (myRent.suggested){
        await Rentals.findById(myRent.suggested)
        .exec()
        .then(rent => {
            suggestedRental= rent
        })
        .catch(err => res.status(500).json({message: "Suggested rental not found", error: err}))
        if(suggestedRental){
            if(suggestedRental.estimated){
                suggestedRental.estimated.price= (suggestedRental.estimated.price*100/95).toFixed(2)
                let foundSale= false;
                i= 0
                for(let sum of suggestedRental.estimated.summary){
                    if(sum.slice(0,22) == "Sconto del 5% per aver"){
                        suggestedRental.estimated.summary.splice(i, 1)
                        foundSale= true;
                        suggestedRental.estimated.summary.push("Rimosso sconto del 5% per aver cancellato il primo ordine del bundle.");
                    }
                    i+=1
                }
                if(foundSale){
                    await Rentals.findOneAndUpdate({_id: myRent.suggested}, suggestedRental)
                    .exec()
                    .then(() => {})
                    .catch(err => {res.status(401).json({message:"Articolo suggerito non aggiornato", error: err})})
                }
            }
        }
    }
    await Rentals.findOneAndDelete({_id: id})
    .exec()
    .then(result => res.status(200).json({message: "Succesfully deleted", result: result}))
    .catch(err => res.status(500).json({message: "Error in delete", error: err}))
})

router.patch('/:id', auth.verifyLogin, async(req, res) =>{
    const id = req.params.id;        
    if(!id) return res.status(404).json({message: "Id missing"})
    let oldRental 
    await Rentals.findById(id)
    .exec()
    .then(rent => {
        oldRental = rent
        return true
    })
    .catch(err => { return res.status(500).json({message: 'Error in patchin (retriving article)'})})
    suggestedRental = false;
    let newData = req.body
    newData.object_id = oldRental.object_id
    if(!newData.date_start) newData.date_start = oldRental.date_start
    if(!newData.date_end) newData.date_end = oldRental.date_end
    if (oldRental.suggested && (newData.date_start != oldRental.date_start || newData.date_end != oldRental.date_end)){
        await Rentals.findById(oldRental.suggested)
        .exec()
        .then(rent => {
            suggestedRental= rent
        })
        .catch(err => res.status(500).json({message: "Suggested rental not found", error: err}))
        suggestedRental.estimated.price= (suggestedRental.estimated.price*100/95).toFixed(2)
        let foundSale= false;
        i= 0
        for(let sum of suggestedRental.estimated.summary){
            if(sum.slice(0,22) == "Sconto del 5% per aver"){
                suggestedRental.estimated.summary.splice(i, 1)
                foundSale= true;
                suggestedRental.estimated.summary.push("Rimosso sconto del 5% per aver modificato il primo ordine del bundle.");
            }
            i+=1
        }
        if(foundSale){
            await Rentals.findOneAndUpdate({_id: oldRental.suggested}, suggestedRental)
            .exec()
            .then(() => {})
            .catch(err => {res.status(401).json({message:"Articolo suggerito non aggiornato", error: err})})
        }
    }
    if(newData.state === 'ended') delete newData.state
    if(newData.state === 'deleted'){
        newData.estimated = {
            price: 0,
            summary: ["Noleggio non approvato."]
        }
    }
    else{
        let isSuggested= false;
        let removedDiscount= false;
        for(let sum of oldRental.estimated.summary){
            if(sum.slice(0,22) == "Sconto del 5% per aver"){
                if(newData.date_start == oldRental.date_start && newData.date_end == oldRental.date_end){
                    isSuggested= sum;
                } else {
                    removedDiscount= true;
                }
            }
        }
        newData.estimated = await helper.estimate_price({piece: newData, user: oldRental.userId, suggested: isSuggested})
        if (removedDiscount){
            newData.estimated.summary.push("Rimosso sconto del 5% per il bundle, avendo modificato le date di questo noleggio.")
        }
    }
    if(req.query.staff){
        newData.estimated.summary.push("Date modificate da un impiegato.");
    }
    if(newData.estimated.err){
        return res.status(401).json({message: "Modify error", error: newData.estimated.err})         
    } else {
        delete newData.object_id
        await Rentals.findOneAndUpdate(
            {_id: id},
            {$set: newData}
            )
            .exec()
            .then(newArticle => {
                return res.status(200).json({message: "Modify success", article: newArticle})
            })
            .catch(err => {
                return res.status(401).json({message: "Modify error", error: err})         
            })
    }
    
})

router.patch('/:id/close', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), async (req, res) => {
    const rentalId = req.params.id
    let oldState = ""
    let oldRental = null
    const newState = req.query.state
    if(!rentalId || !newState) return res.status(400).json({message: "Rental Id/New state missing"})
    else{
        await Rentals.findById(rentalId)
            .exec()
            .then(async rental => {
                oldRental = rental
                await Articles.findById(rental.object_id)
                .exec()
                .then(async article => {
                    oldState = article.state === "unavailable" ? article.oldState : article.state
                    if(newState && newState != oldState){
                        if(stateDict[newState] != 0 && stateDict[oldState] != 0){
                            if(stateDict[newState] < stateDict[oldState]){
                                errorUpdating = await helper.updateRentals(rental.object_id, true);
                            } else {
                                errorUpdating = await helper.updateRentals(rental.object_id, false);
                            }
                        }
                    }
                })
                .catch(() => oldState = null)
            })
        if(oldState === null) return res.status(404).json({message: "Error in retriving article"})
        else {
            // articlePrice
            let modify = {
                state: 'ended',
                estimated: {...oldRental.estimated}
            }
            // Applico sovraprezzo
            if(articlePrice[oldState] > articlePrice[newState]){
                const percentage = articlePrice[oldState] - articlePrice[newState]
                modify.estimated.price = parseFloat(modify.estimated.price) + parseFloat(modify.estimated.price) * parseFloat(percentage)
                modify.estimated.price = modify.estimated.price.toFixed(2)
                modify.estimated.summary.push(`Sovraprezzo applicato del ${(percentage*100).toFixed(2)}% date le condizioni in cui l'articolo è stato restituito`)
                await Articles.findOneAndUpdate(
                    {_id: oldRental.object_id},
                    {$set: { state: newState }}
                )
                .exec()
                .then(() => {})
                .catch((err) => {console.log(err)})
            }
            await Rentals.findOneAndUpdate({_id: rentalId}, {
                $set: modify
            })
            .exec()
            .then(result => res.status(200).json({message: 'Rental closed'}))
            .catch(error => res.status(400).json({message: 'Rental closed error', error: error}))
        }

    }
})

router.patch('/suggested/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]), async (req, res) => {
    const id= req.params.id;
    const newArticleId = req.query.article;
    let oldRental;
    await Rentals.findById(id)
    .exec()
    .then(rent => {
        oldRental = rent
        return true
    })
    .catch(err => { res.status(500).json({message: 'Error in patchin (retriving article)'})})
    await Articles.findById(oldRental.object_id)
    .exec()
    .then(oldartcl => {
        if(oldartcl.state == "unavalaible" && oldartcl.state == "broken")
            res.status(500).json({message: 'OldArticle is available!'})
    })
    .catch(err => { res.status(500).json({message: 'Error in old rental (old article not found)'})})
    const oldPrice = oldRental.estimated.price;
    let newRental = {...oldRental._doc}
    newRental.object_id = new mongoose.Types.ObjectId(newArticleId);
    newRental.estimated = await helper.estimate_price({piece: newRental});    
    if(newRental.estimated.err)
        res.status(400).json({message: 'Error in estimating price', error: newRental.estimated.err})
    else {
        let newData;
        if(parseFloat(newRental.estimated.price) > parseFloat(oldPrice)){
            newData= oldRental;
            newData.object_id = new mongoose.Types.ObjectId(newArticleId);
            newData.estimated.summary.push(`Prezzo non variato per indisponibilità del vecchio articolo! (Prezzo al pubblico del corrente articolo = €${parseInt(newRental.estimated.price)})`);
        }else{
            newData= newRental
        }
        newData.worse= false;
        await Rentals.findOneAndUpdate(
            {_id: id},
            {$set: newData}
            )
            .exec()
            .then(newArticle => {
                res.status(200).json({message: "Modify success", article: newArticle})
            })
            .catch(err => {
                res.status(401).json({message: "Modify error", error: err})         
            })
    }
})

router.patch('/relateSuggest/:id',auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["customer"]), async (req, res) => {
    const id= req.params.id;
    const suggested= req.query.suggested;
    if(!suggested)
        return res.status(401).json({message: "Suggested article not provided"})
    await Rentals.findOneAndUpdate(
        {_id: id},
        {suggested: suggested}
    )
    .exec()
    .then(Rental => {
        res.status(200).json({message: "Suggested rental added", rental: Rental})
    })
    .catch((err => {
        res.status(401).json({message: "Modify error", error: err})
    }))
})

module.exports = router;