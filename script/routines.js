let cron = require('node-cron')
const Rentals = require('./api/models/model_rental')
const Articles = require('./api/models/model_article')

// const period = '0 0 0 * * *'
const period = '*/15 * * * * *'

let setEndedDaysAgoToDelayed = cron.schedule(period, () => {
    Rentals.find({
        date_end: {$lt: new Date().toISOString().split('T')[0]},
        state: 'progress'
    })
    .exec()
    .then(async rentals => {
        for(const rental of rentals){
            let toUpdate = {
                state: 'delayed',
                estimated: {...rental.estimated},
                delayed: true
            }
            toUpdate.estimated.price = (parseFloat(toUpdate.estimated.price) * 1.20).toFixed(2)
            toUpdate.estimated.summary.push("Prezzo aumentato del 20% dato il ritardo nella restituzione")

            await Rentals.findOneAndUpdate(
                {_id: rental._id},
                {$set: toUpdate}
            )
            .exec()
            .then(res=>{console.log("Routine (setEndedDaysAgoToDelayed) setted rental to delayed: ", rental)})
            .catch(error=>{console.error(error)})

            let oldArticle = undefined

            await Articles.findOne({_id: rental.object_id})
                    .exec()
                    .then(arti => oldArticle = arti)
                    .catch(err => oldArticle = undefined)
            if(oldArticle){
                await Articles.findOneAndUpdate(
                    {_id: rental.object_id},
                    {$set: {state: 'unavailable', oldState: oldArticle.state }}
                )
                .exec()
                .then(res => {})
                .catch(error=>{console.error(error)})
            }
        }
    })
    .catch(err => console.error(err))
})

let deleteUnavailableRentals = cron.schedule(period, async () => {
    let not_availables = []
    await Articles.find({state: {$in: ['broken', 'unavailable']}})
            .exec()
            .then(result => {
                result.forEach(x=>not_availables.push(x._id))
            })
            .catch(()=>{})
    console.log("Not availables: ", not_availables)
    let rentals_todelete = []
    await Rentals.find({
            state: 'approved',
            date_start: {$lt: new Date().toISOString().split('T')[0]},
            object_id: {$in: not_availables}
        })
        .exec()
        .then(rentals => {
            rentals.forEach(rental => rentals_todelete.push(rental._id))
        })
    console.log("To delete: ", rentals_todelete)
    rentals_todelete.forEach(async rentalId => {
        const newEstimated = {
            price: 0,
            summary: ["Articolo indisponibile/rotto non cambiato prima dell'inizio del noleggio"]
        }
        await Rentals.findOneAndUpdate({_id: rentalId}, {$set: {state: 'deleted', estimated: newEstimated}})
        .exec()
        .then(() => {console.log("Routine (deleteUnavailableRentals) changed unavailable rental: ", rentalId)})
        .catch(()=> {})
    })
})

function startRoutines(){
    setEndedDaysAgoToDelayed.start()
    deleteUnavailableRentals.start()
}

function stopRoutines(){
    setEndedDaysAgoToDelayed.stop()
    deleteUnavailableRentals.stop()
}

exports.startRoutines = startRoutines
exports.stopRoutines = stopRoutines