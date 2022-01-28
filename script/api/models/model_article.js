const mongoose = require('mongoose')

const articles_schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    name: {
        type: String,
        required: true,
    },
    category: {
        /*type: mongoose.Schema.Types.String,
        ref: 'Category.name',*/
        type: String,
        required: true,
    },
    superCategory: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        enum: ['perfect', 'good', 'suitable', 'broken', 'unavailable'],
        required: true,
    },
    price: {
        type: Number,
        required: true
    },
    img: {
        type: String
    },
    oldState: {
        required: false,
        type: String
    }
});

module.exports = mongoose.model("article", articles_schema);