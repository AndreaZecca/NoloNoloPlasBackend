const express = require('express');
const mongoose = require('mongoose');
const auth = require('./auth');

const Payment = require('./models/model_paymentmethod');

var router = express.Router();

router.get('/', (req, res) => {
    Payment.find()
    .exec().
    then(pymnts => {
        res.status(200).json(pymnts)
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
})

router.post('/', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["admin"]), (req, res) => {
    const data = req.body;
    console.log(data)
    data._id = new mongoose.Types.ObjectId()
    const newPayment = new Payment(data)
    newPayment.save()
    .then(resulter => {
        res.status(200).json({message: 'Payment method saved successfully'})
    })
    .catch(err => {
        res.status(500).json({message: 'Error', error: err})
    })
})

router.delete('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["admin"]), async (req, res) => {
    const id = req.params.id;
    await Payment.findOneAndDelete({_id: id})
    .exec()
    .then(result => res.status(200).json({message: "Succesfully deleted", result: result}))
    .catch(err => res.status(500).json({message: "Error in delete", error: err}))
})

module.exports = router;