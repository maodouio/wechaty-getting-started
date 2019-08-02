#!/usr/bin/env node
/**
 *   Powered by Wechaty - https://github.com/chatie/wechaty
 *
 *   @author limingth <limingth@maodou.io>
 *
 *   This is a maodouketang reminder wechat bot.
 *   It can alert you when your class time is up.
 *   You can get alert by 4 ways: sms, call, email and wxmsg(wechat-miniapp-msg)
 */
const {
    Wechaty,
    MiniProgram,
} = require('wechaty')
const qrTerm = require('qrcode-terminal')

// import Debug from 'debug'
// const debug = Debug('maodou:api/utils/agenda.js')
const debug = require("debug")("maodou-live-bot.js")
const createLive = require('./maodou-live-api.js')
const createCourseWithLive = require('./maodou-ketang-api.js')

const chalk = require('chalk')
const _ = require('underscore')
/*
 * Declare the Bot
 *
 */

const bot = new Wechaty({
    //profile: config.default.DEFAULT_PROFILE,
    profile: 'maodou',
})

/**
 *
 * Register event handlers for Bot
 *
 */
bot
    .on('logout', onLogout)
    .on('login', onLogin)
    .on('scan', onScan)
    .on('error', onError)
    .on('message', onMessage)

/**
 *
 * Start the bot!
 *
 */
// getDaily()
bot.start()
    .catch(async e => {
        console.error('Bot start() fail:', e);
        await bot.stop();
        process.exit(-1)
    })

/**
 *
 * Define Event Handler Functions for:
 *  `scan`, `login`, `logout`, `error`, and `message`
 *
 */
function onScan(qrcode, status) {
    //qrTerm.generate(qrcode, {small: true})
    qrTerm.generate(qrcode)

    // Generate a QR Code online via
    // http://goqr.me/api/doc/create-qr-code/
    const qrcodeImageUrl = [
        'https://api.qrserver.com/v1/create-qr-code/?data=',
        encodeURIComponent(qrcode),
    ].join('')

    console.log(`[${status}] ${qrcodeImageUrl}\nScan QR Code above to log in: `)
}

async function onLogin(user) {
    console.log(`${user.name()} login`)
}

function onLogout(user) {
    console.log(`${user.name()} logouted`)
}

function onError(e) {
    console.error('Bot error:', e)
}

/**
 *
 * Dealing with Messages
 *
 */
async function onMessage(msg) {
    const room = msg.room()
    const from = msg.from()
    const contact = bot.userSelf()

    // console.log('\n\ncontact is', from)


    if (!from) {
        return
    }

    // console.log('\n\nmsg is', msg)
    if(from.payload.name === '俊良'){
        msg.forward(from)
    }
    // msg.say(contact)
}

