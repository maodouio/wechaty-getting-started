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
    UrlLink,
} = require('wechaty')
const qrTerm = require('qrcode-terminal')

// import Debug from 'debug'
// const debug = Debug('maodou:api/utils/agenda.js')
const debug = require("debug")("maodou-ketang-bot.js");
const createCourse = require('./maodou-ketang-api.js')
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

function makeReport(course) {
    let news = '[课程提醒创建成功通知]\n'

    let title = '\n标题: ' + course.title + '\n'
    let time = '时间: ' + new Date(course.start_time).toLocaleString() + '\n'
    let location = '地点: ' + course.location + '\n'
    let notes = '\n消息原文: \n' + course.notes + '\n'

    let report = news + title + time + location + notes

    return report
}

/**
 * send a report
 */
async function sendReportToRoom(report, room_topic) {
    const room = await bot.Room.find({topic: room_topic}) //get the room by topic
    if (room)
        console.log('Sending Report to room ', room_topic, 'id:', room.id)
    else
        console.log('room_topic ', room_topic, '不存在')

    debug('report', report)
    room.say(report)
}

/**
 * send a miniProgram
 */
async function sendMiniProgramToRoom(linkPayload, room_topic) {
  const room = await bot.Room.find({topic: room_topic}) //get the room by topic
  if (room)
    console.log('Sending Report to room ', room_topic, 'id:', room.id)
  else
    console.log('room_topic ', room_topic, '不存在')

  debug('linkPayload', linkPayload)
  room.say(linkPayload)
}

/**
 *
 * Dealing with Messages
 *
 */
async function onMessage(msg) {
    const room = msg.room()
    const from = msg.from()

    if (!from) {
        return
    }

    console.log((room ? '[' + await room.topic() + ']' : '')
              + '<' + from.name() + '>'
              + ':' + msg,
    )

    if (msg.type() !== bot.Message.Type.Text) {
        console.log('[Bot] ==> Message discarded because it is not a text message')
        return
    }

    // Skip message from self
    if (msg.self() || from.name() === '微信团队' || from.name() === '毛豆课堂小助手' ) {
        console.log('[Bot] ==> Message discarded because it is from self or 毛豆课堂小助手')
        return
    }

    // Now we begin to parse this msg
    let msgText = msg.text()
    debug('[original]', {msgText})

    const room_topic = room ? await room.topic() : null

    // create course using msgText, and send report to wechat admin group
    createCourse(msgText, function(newCourse) {
        debug("[newCourse]", newCourse)
        // get report from newCourse
        var report = makeReport(newCourse)
        console.log("[New course report]", report)

        //say url for miniprogram
        const linkPayload = new UrlLink({
          description: 'reserve',
          thumbnailUrl: 'reserve',
          title: newCourse.title,
          url: newCourse._id
        })

        // only these 2 admin groups will receive report
        if (room_topic === 'wechaty 小程序PR' ){
            sendReportToRoom(report, room_topic)
            sendMiniProgramToRoom(linkPayload, room_topic)
	}

        // send all report to dev team group for debugging
        sendReportToRoom(report, '毛豆少儿课堂产品开发组')
        sendMiniProgramToRoom(linkPayload, '毛豆少儿课堂产品开发组')

        // if this message is from a single chatter, just send report back to this chatter
        if (!room_topic){
          msg.say(report)
          msg.say(linkPayload)
        }
    })
}

