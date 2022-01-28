const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer')

const Users = require('./models/model_user');
const Rentals = require('./models/model_rental')
const auth = require('./auth');

const avatarFullPath = path.join(global.rootDir, 
    '/public/img/customersAvatar/');

var router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, avatarFullPath)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    },
});

async function deleteAvatar(avatar) {
    if (avatar !== null && avatar !== undefined && avatar!== "") {
        try {
            await fs.unlinkSync(path.join(avatarFullPath, path.basename(avatar)))
        } catch (err) {
            console.log('Error while removing avatar')
            console.log({ error: err })
        }
    }
}

const upload = multer({ storage: storage });

router.get('/', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), (req,res) => {
    Users.find()
    .exec().
    then(usrs => {
        res.status(200).json(usrs)
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
})

router.post('/', upload.single('avatar'), async (req, res) => {
    let data = req.body;
    data.password = data.password ? await bcrypt.hash(data.password, 14) : undefined;
    data._id = new mongoose.Types.ObjectId();
    data.avatar = req.file ? req.file.filename : ''
    const newUser = new Users(data);
    newUser.save()
    .then(result => {
        res.status(200).json({
            message: "user created",
            user: newUser
        })
    })
    .catch(err => {
        deleteAvatar(data.avatar)
        res.status(400).json({message: "Error in creating user", error: err})
    })
})

router.get('/:id', auth.verifyLogin, (req, res) => {
    const id = req.params.id;
    Users.findOne({_id: id})
    .exec().
    then(usr => {
        if(usr) res.status(200).json(usr)
        else res.status(401).json({message: "User not found"})
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
})

router.delete('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), async (req, res) => {
    const id = req.params.id;
    await Users.findOneAndDelete({_id: id})
    .exec()
    .then(result => {
        deleteAvatar(result.avatar)
        res.status(200).json({message: "Successfully deleted", result: result})
    })
    .catch(err => res.status(500).json({message: "Error in delete", error: err}))
})

router.patch('/:id', auth.verifyLogin, upload.single('avatar'), async (req, res) => {
    const id = req.params.id
    let delImg = false
    if(!id) return res.status(404).json({message: "Id missing"})
    let newData = req.body
    if(req.file){
        delImg = true
        newData.avatar = req.file.filename
    } 
    if(newData.password) newData.password = await bcrypt.hash(newData.password, 14)
    await Users.findOneAndUpdate(
        {_id: id},
        {$set : newData}
        )
        .exec()
        .then(async oldUser => {
            if(delImg && oldUser.avatar !== null) {
		        await deleteAvatar(oldUser.avatar)
            }
            return res.status(200).json({message : "Modify success (old User)" , user : oldUser});
        })
        .catch(err => {
            return res.status(401).json({message : "Modify error" , error : err});
        })
})

router.get('/:id/rentals', auth.verifyLogin, async (req,res) => {
    const queryPassed = req.query
    const query = {}
    let multiquery= {}
    if(queryPassed.state)
        multiquery = {'$in' : queryPassed.state.split(',')}
    if (queryPassed.state) query.state = multiquery;
    if (queryPassed.date_start) query.date_start = queryPassed.date_start
    if (queryPassed.date_end) query.date_end = queryPassed.date_end
    const id = req.params.id;
    if(!id) return res.status(404).json({message: "Id missing"})
    await Rentals.find(
        {userId : id, ...query})
        .exec()
        .then(rents => {
            return res.status(200).json(rents)
        })
        .catch(err => res.status(400).json({message:"Error", error:err}))
})

router.post('/:id/preferences', auth.verifyLogin, async (req, res) => {
    const id = req.params.id
    if (!id) return res.status(404).json({message: "Missing id"})
    else {
        const preferences = req.body.preferences
        await Users.findById(id)
        .exec()
        .then(async user => {
            let oldPref = user.preferences
            oldPref.push(preferences)
            await Users.findOneAndUpdate(
                {_id: id},
                {$set: {preferences: oldPref}}
            )
            .exec()
            .then(result => res.status(200).json({message: 'preferences added'}))
            .catch(err => res.status(500).json({message: 'Error occured'}))
        })
        .catch(err => res.status(500).json({message: 'Error occured'}))
    }
})

router.delete('/:id/preferences', async (req, res) => {
    const id = req.params.id
    if (!id) return res.status(404).json({message: "Missing id"})
    else {
        const prefToDelete = req.body.preferences
        await Users.findById(id)
        .exec()
        .then(async user => {
            let oldPref = user.preferences
            let newPref = oldPref.filter(x => !prefToDelete.includes(x))
            await Users.findOneAndUpdate(
                {_id: id},
                {$set: {preferences: newPref}}
            )
            .exec()
            .then(result => res.status(200).json({message: 'preferences removed'}))
            .catch(err => res.status(500).json({message: 'Error occured'}))
        })
        .catch(err => res.status(500).json({message: 'Error occured'}))
    }
})

module.exports = router;