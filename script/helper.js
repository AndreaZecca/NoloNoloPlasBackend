const Rentals = require('./api/models/model_rental');
const Articles = require('./api/models/model_article');
const Crusades = require('./api/models/model_crusade');

const articlePrice = {'perfect' : 1, 'good': 0.8, 'suitable' : 0.4, 'broken' : 0, 'unavailable': 0};

async function updateRentals(id, isWorse){
    let toRet= false;
    await Rentals.updateMany(
        {object_id: id, state: {$in: ['pending', 'approved']}},
        {$set: {worse: isWorse}}
        )
        .exec()
        .then(async oldRentals => {
            toRet= false;
        })
        .catch(err => {
            toRet= true;
        })
    return toRet
}

async function isCrusade(start, end){
    let crusade = false
    await Crusades.find({
        date_start: { $lte: start},
        date_end: { $gte: end},
    }).exec()
    .then( crusades => {
        if (crusades.length > 0) crusade = true
    } )
    .catch(err => {})
    return crusade
}



async function checkSuggested(suggested, start, end, toSugg){
    await Articles.findOne({_id: suggested})
        .exec()
        .then(async artcl => {
            await Rentals.find(
                {object_id: artcl._id,
                 date_start: start,
                 date_end: end
                })
                .exec()
                .then(rents => {
                    if(rents){
                            toSugg=artcl.name;
                        }
                })
                .catch(err => {return})
        })
        .catch(err=>{return})
        return toSugg;
}

async function checkUser(user, nRents, delayer){
    await Rentals.find(
        {userId : user})
        .exec()
        .then(rents => {
            nRents = 0
            for(let rent of rents){
                if (rent.delayed){
                    delayer= true;
                }
                if (rent.state == "ended")
                    nRents+=1;
                }
        })
        .catch(err => {return})
        if(delayer)
            nRents= 0;
        return {nRents, delayer};
}

async function estimate_price(args){
    const {piece, id, start, end, user, suggested} = {...args}
    const articlesId = id || piece.object_id 
    let nRents = 0;
    let delayer = false;
    if(user){
        const myresult = await checkUser(user, nRents)
        nRents = myresult.nRents;
        delayer = myresult.delayer;
    }
    let toSugg = '';
    if(suggested){
        if(suggested.slice(0,22) == "Sconto del 5% per aver"){
            toSugg= suggested;
        } else{
            toSugg= await checkSuggested(suggested, start, end, toSugg);
        }
    }
    let toReturn = {
        price: 0,
        summary: []
    }
    await Articles.findById(articlesId)
            .exec()
            .then(async article => {
                let weight = articlePrice[article.state]
                if (weight === 0){
                    toReturn.err = 'Not allowed to rent a broken article'
                    return
                }
                if (weight < 1){
                    toReturn.summary.push(`Sconto del ${((1-weight)*100).toFixed(2)}% date le condizioni dell'articolo(${article.state})`)
                }
                let rentsPrice= 1
                if(nRents > 0){
                    rentsPrice= (Math.min(nRents, 5))/100
                    toReturn.summary.push(`Sconto del ${(rentsPrice*100).toFixed(2)}%  per ringraziarti dei noleggi passati!`)
                    rentsPrice= 1 - rentsPrice
                } else if(delayer){
                    rentsPrice = 20;
                    toReturn.summary.push(`Sovrapprezzo del ${rentsPrice.toFixed(2)}% per aver restuito in passato oggetti in ritardo.`)
                    rentsPrice= 1.2
                }
                let suggPrice= 1
                if(toSugg != ''){
                    suggPrice= 0.95;
                    if(toSugg.slice(0,22) == "Sconto del 5% per aver"){
                        toReturn.summary.push(toSugg);
                    } else {
                        toReturn.summary.push(`Sconto del 5% per aver acquistato un nostro suggerimento dopo il seguente noleggio: ${toSugg}.`);
                    }
                }
                const endDate = Date.parse(end || piece.date_end)
                const startDate = Date.parse(start || piece.date_start)
                
                let days = Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24)
                
                if(days > 7){
                    days = days - 1
                    toReturn.summary.push("Superati i 7 giorni, 1 viene regalato")
                }
                toReturn.price = (days*article.price*weight*rentsPrice*suggPrice).toFixed(2) 
                
                if(await isCrusade(startDate, endDate)){
                    toReturn.price = (toReturn.price * 0.75).toFixed(2)
                    toReturn.summary.push("Sconto del 25% per aver acquistato in tempo di crociata")
                }
            })
            .catch(() => {
                toReturn.err = 'Error in price Estimation'
                return toReturn
            })
    return toReturn
}

async function checkAval(id, start, end, searchOpt){
    let search = { 
        object_id : id,
        ...searchOpt,
        $or: [
            { date_start: {$lte: start}, date_end: {$gte: start} },
            { date_start: {$lte: end}, date_end: {$gte: end} },
            { date_start: {$gte: start}, date_end: {$lte: end} }
        ],
        state: {$in : ["pending", "approved", "progress"]}
    }
    let available = true
    if (!Date.parse(start) || !Date.parse(end) || start > end){
        return false;
    }
    await Rentals.find(search)
        .exec()
        .then(async rents => {
            available = rents && rents.length === 0
        } )
        .catch(() => {
            available = false;
        })
    return available
}


module.exports.estimate_price = estimate_price;
module.exports.checkAval = checkAval;
module.exports.isCrusade = isCrusade;
module.exports.updateRentals = updateRentals;
