const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path')
const fs = require('fs')
const bcrypt = require('bcryptjs')
const multer = require('multer')


const auth = require('./auth');
const Staffs = require('./models/model_staff');
const Rentals = require('./models/model_rental');

const avatarFullPath = path.join(global.rootDir, 
    '/public/img/employeesAvatar/');

var router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, avatarFullPath)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    },
});

const upload = multer({ storage: storage });

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

router.get('/', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["admin"]), (req, res) => {
    Staffs.find()
    .exec().
    then(staffs => {
        res.status(200).json(staffs)
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
})

router.get('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["admin"]), (req, res) => {
    const id = req.params.id;
    Staffs.findOne({_id: id})
    .exec().
    then(staff => {
        if(staff) res.status(200).json(staff)
        else res.status(401).json({message: "User not found"})
    })
    .catch(err => {
        res.status(400).json({message: 'Server error', error: err})
    });
})

router.post('/', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["admin"]), upload.single('avatar'), async (req, res) => {
    let data = req.body;
    data.password = data.password ? await bcrypt.hash(data.password, 14) : undefined;
    data._id = new mongoose.Types.ObjectId();
    data.avatar = req.file ? req.file.filename : ''
    const newStaff = new Staffs(data);
    newStaff.save()
    .then(result => {
        res.status(200).json({
            message: "employee created",
            user: newStaff
        })
    })
    .catch(err => {
        deleteAvatar(data.avatar)
        res.status(400).json({message: "Error in creating employee", error: err})
    })
})

router.delete('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["admin"]), (req, res) => {
    const id = req.params.id;
    Staffs.findOneAndDelete({_id: id})
    .exec()
    .then(result => {
        deleteAvatar(result.avatar)
        res.status(200).json({message: "Successfully deleted", result: result})
    })
    .catch(err => res.status(500).json({message: "Error in delete", error: err}))
})

//forse per modificare uno dello staff serve una autenticaione particolare
router.patch('/:id', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), upload.single('avatar'), async (req, res) => {
    const id = req.params.id;
    let delImg = false
    if(!id) return res.status(404).json({message: "Id missing"})
    let newData = req.body
    if(newData.password) newData.password = await bcrypt.hash(newData.password, 14)
    if(req.file){
        delImg = true
        newData.avatar = req.file.filename
    } 
    await Staffs.findOneAndUpdate(
        {_id: id},
        {$set : newData}
        )
        .exec()
        .then(async oldEmpl => {
	    if(delImg && oldEmpl.avatar !== null){
           	await deleteAvatar(oldEmpl.avatar)
        }
        res.status(200).json({message : "Modify success (old Employee)" , employee : oldEmpl});
        })
        .catch(err => {
            res.status(401).json({message : "Modify error" , error : err});
        })
})

router.get('/:id/rentals', auth.verifyLogin, auth.verifyAuth(auth.authLevelDict["employee"]), async (req,res) => {
    const queryPassed = req.query
    const query = {}
    if (queryPassed.state) query.state = queryPassed.state
    if (queryPassed.date_start) query.date_start = queryPassed.date_start
    if (queryPassed.date_end) query.date_end = queryPassed.date_end
    const id = req.params.id;
    if(!id) return res.status(404).json({message: "Id missing"})
    await Rentals.find(
        {functionaryId : id, ...query})
        .exec()
        .then(rents => {
            res.status(200).json(rents)
        })
        .catch(err => res.status(400).json({message:"Error", error:err}))
})

module.exports = router;