const mongoose = require('mongoose');

const crusades_schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    date_start: {
        type: Date,
        required: true
    },
    date_end: {
        type: Date,
        required: true
    }
});

module.exports = mongoose.model("crusade", crusades_schema);