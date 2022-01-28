const mongoose = require('mongoose');
const Payment_Methods = require('./model_paymentmethod');

const users_schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    name: {
        type: String,
        required: true,
    },
    surname: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        required: true,
        unique: true,
        dropDups: true
    },
    password: {
        type: String,
        required: true,
    },
    paymentmethod: {
        /*type: mongoose.Schema.Types.String, 
        ref: 'Payment_Methods.name',*/
        type: String,
        required: true,
    },
    residence: {
        type: String,
    },
    preferences: {
        type: Array
    },
    notes: {
        type: Array
    },
    avatar: String,
});

module.exports = mongoose.model("user", users_schema);