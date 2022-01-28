const mongoose = require('mongoose');

const paymentmethod_schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    name: {
        type: String,
        required: true,
        unique: true,
        dropDups: true
    }
});

module.exports = mongoose.model('payment_method', paymentmethod_schema);
