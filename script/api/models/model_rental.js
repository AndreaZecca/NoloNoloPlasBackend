const mongoose = require('mongoose');
const Users = require('./model_user');
const Staffs = require('./model_staff');
const article = require('./model_article');

const rentals_schema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: Users,
        required: true
    },
    functionaryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: Staffs,
    },
    object_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: article,
        required: true
    },
    date_start: {
        type: Date,
        required: true
    },
    date_end: {
        type: Date,
        required: true
    },
    estimated: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    state: {
        type: String,
        // Pending=Utente fa richiesta ma employee non ha ancora approvato
        // Approved=Utente fa richiesta ed employee ha approvato
        // Progress=Rental in progress (iniziato ma non finito)
        // Delayed=Rental attualmente in ritardo => il campo delayed viene settato a true
        // Ended=Rental finito (oggetto restituito)
        // Deleted=Rental eliminato per qualsiasi motivo
        enum: ['pending', 'approved', 'progress', 'ended', 'delayed', 'deleted'],
        required: true
    },
    delayed: {
        type: Boolean,
        required: false
    },
    suggested: {
        type: String,
    },
    worse: {
        required: false,
        type: Boolean
    }
});

module.exports = mongoose.model("rental", rentals_schema);