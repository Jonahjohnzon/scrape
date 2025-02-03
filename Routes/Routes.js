const express = require('express')
const router = express.Router()
const {PushMovie} = require('../Controller/Controller')


router.post('/pushmovie/:type/:id', PushMovie)
module.exports = router