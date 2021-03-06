const express = require('express');
const Users = require('./models/model_user');
const Staffs = require('./models/model_staff');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let router = express.Router();
const keysPath = path.join(global.rootDir, '.keys');
const privateKey = fs.readFileSync(path.join(keysPath, 'jwtRS256.key'));
const publicKey = fs.readFileSync(path.join(keysPath, 'jwtRS256.key.pub'));


const authLevelDict = {
    "admin" : 4,
    "employee": 3,
    "customer": 2,
    "unregistered": 1,
}


function verifyAuth(requiredAuth){
    return async function(req, res, next){
        let auth = req.tokenDecoded.auth;
        if(auth >= requiredAuth){
            next();
        }
        else{
            return res.status(401).json({message: "Auth level not sufficient"});
        } 
    }
}

async function verifyLogin(req, res, next){
    if('authority' in req.headers && req.headers['authority'] !== null && req.headers['authority']){
        let authHeader, token
        try{
            authHeader = req.headers['authority'];
            token = await JSON.parse(authHeader);
        }
        catch(err){
            return res.status(400).json({message: "Error in retriving token from header", error: err});
        }
        if(token){
            await jwt.verify(token, publicKey, {algorithm : 'RS256'}, (err, decoded)=>{
                if(!err) {
                    req.tokenDecoded = decoded;
                    next();
                }
                else return res.status(401).json({message: "Error in verifying token", error: err});
            })
        }
        else return res.status(401).json({message: "Missing token"});
    }
    else
        return res.status(401).json({message: "Required auth token"})
}

async function checkUser(user, data, res, authLevel){
    if(!user || user===null)
        return res.status(404).json({message: "User not found"});
    else if (! (await bcrypt.compare(data.password || "", user.password)))
        return res.status(403).json({message: "Your password is incorrect"});
    const token = await generateToken(authLevel, user._id, user.username);
    return res.status(200).json({ "authority": token });
}

async function generateToken(authLvl, id, username){
    const unsignedToken = {
        auth: authLvl,
        username: username,
        id: id
    }
    const token = 
        await jwt.sign(
            unsignedToken, 
            privateKey, 
            {algorithm: "RS256", expiresIn: "31d"}
        );
    return token;
}

router.post('/login/users', async (req, res)=>{
    let data = req.body;
    await Users.findOne({username : data.username})
    .exec()
    .then( usr => {
     	checkUser(usr, data, res, authLevelDict["customer"])
    })
    .catch( err => {
        res.status(500).json({message: "Username not found", error: err});
    })
})

router.post('/login/staff', async (req, res)=>{
    let data = req.body;
    let rolePassed = req.query.role
    let query = { username: data.username }
    if (rolePassed) query.role = rolePassed
    await Staffs.findOne(query)
    .exec()
    .then( empl => {
        checkUser(empl, data, res, authLevelDict[empl.role])
    })
    .catch( err => {
        res.status(500).json({message: "No User found", error: err});
    })
})

router.get('/publicKey', (req, res) => {
    return res.status(200).json({ publicKey: publicKey.toString() })
})

module.exports = router
module.exports.verifyAuth = verifyAuth
module.exports.verifyLogin = verifyLogin
module.exports.checkUser = checkUser
module.exports.generateToken = generateToken
module.exports.authLevelDict = authLevelDict