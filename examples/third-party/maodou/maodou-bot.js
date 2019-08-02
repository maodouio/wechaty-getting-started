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

//type: live course meeting
function makeReport(course, report_type, live_id) {
    let report
    let news = '[课程提醒创建成功通知]\n'

    let title = '\n标题: ' + course.title + '\n'
    let time = '时间: ' + new Date(course.start_time).toLocaleString() + '\n'
    let location = '地点: ' + course.location + '\n'
    let notes = '\n消息原文: \n' + course.notes + '\n'

    if(report_type = 'live'){
      let invite_url = '\n邀请连麦链接\nhttps://smh.maodou.io/invite/' + live_id + '/1234567890'
      let admin_url = '\n\n直播间后台链接\nhttps://smh.maodou.io/admin/content/course/' + live_id

      report = news + title + time + location + notes + invite_url + admin_url
    }
    else if(report_type = 'course'){
      report = '[毛豆少儿课堂]\n您已成功创建[' + title + ']直播课\n\n' +
                '直播' + time + '\n' +
                '直播地址：https://maodouketang.com\n' + 
                '请您授权手机号并进入后台提前备课\n\n' + 
                '温馨提示：请您提前安排时间准时开课。' 
    }
    else{
      report = news + title + time + location + notes
    }

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
    console.log(chalk.red('[original text]'), {msgText})

    const room_topic = room ? await room.topic() : null

    const reg = /zoom|视频会议|音频会议|演讲|群学习/g

    if(msgText.match(/直播/g)){
      // create course using msgText, and send report to wechat admin group
      createLive(msgText, function(liveId) {
        debug("[liveId]", liveId)
        console.log(chalk.red('匹配到直播关键词，创建直播'), liveId)
        createCourseWithLive(msgText, liveId, function(newCourse){
          // get report from newCourse
          var report = makeReport(newCourse, liveId, 'live')
          console.log("[New course report]", report)

          //say url for miniprogram
          const linkPayload = new UrlLink({
            description: 'reserve',
            thumbnailUrl: 'reserve',
            title: newCourse.title,
            url: newCourse._id
          })

          const room_list = ['毛豆网北京团队', 'wechaty 小程序PR', '毛豆课堂小助手测试群']
          if(_.contains(room_list,room_topic)){
            console.log(chalk.cyan("[in room list]"), room_topic)
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
      })
    }
    else if(msgText.match(reg)){
      console.log(chalk.red('匹配到会议关键词'))
      let meeting_url
      if(msgText.match(/zoom|视频会议/g)){
        meeting_url = '\n视频会议链接\nhttps://kaihui.maodou.io/j/683175?mode=zoom'
      }
      else if(msgText.match(/音频会议/g)){
        meeting_url = '\n音频会议链接\nhttps://kaihui.maodou.io/j/683175?mode=audio'
      }
      else if(msgText.match(/演讲/g)){
        meeting_url = '\n演讲链接\nhttps://kaihui.maodou.io/j/683175?mode=lecture'
      }
      else if(msgText.match(/群学习/g)){
        meeting_url = '\n群学习链接\nhttps://kaihui.maodou.io/j/683175?mode=qunlearn'
      }

      createCourseWithLive(msgText, null, function(newCourse){
        // get report from newCourse
        var report = makeReport(newCourse, null, null)
        report += meeting_url
        console.log("[New course report]", report)

        //say url for miniprogram
        const linkPayload = new UrlLink({
          description: 'reserve',
          thumbnailUrl: 'reserve',
          title: newCourse.title,
          url: newCourse._id
        })

        const room_list = ['毛豆网北京团队', 'wechaty 小程序PR', '毛豆课堂小助手测试群']
        if(_.contains(room_list,room_topic)){
          console.log(chalk.cyan("[in room list]"), room_topic)
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
    else if(msgText.match(/创建课程：|创建课程:/g)){
      console.log(chalk.red('匹配到创建课程关键词'))
      createCourseWithLive(msgText, null, function(newCourse){
        // get report from newCourse
        var report = makeReport(newCourse,null,'course')
        let course_notes = '\n\n'
        console.log("[New course report]", report)

        //say url for miniprogram
        const linkPayload = new UrlLink({
          description: 'reserve',
          thumbnailUrl: 'reserve',
          title: newCourse.title,
          url: newCourse._id
        })

        const room_list = ['毛豆网北京团队', 'wechaty 小程序PR', '毛豆课堂小助手测试群']
        if(_.contains(room_list,room_topic)){
          console.log(chalk.cyan("[in room list]"), room_topic)
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
    else {
      console.log(chalk.red('没有匹配到直播关键词'))
      createCourseWithLive(msgText, null, function(newCourse){
        // get report from newCourse
        var report = makeReport(newCourse,null,null)
        console.log("[New course report]", report)

        //say url for miniprogram
        const linkPayload = new UrlLink({
          description: 'reserve',
          thumbnailUrl: 'reserve',
          title: newCourse.title,
          url: newCourse._id
        })

        const room_list = ['毛豆网北京团队', 'wechaty 小程序PR', '毛豆课堂小助手测试群']
        if(_.contains(room_list,room_topic)){
          console.log(chalk.cyan("[in room list]"), room_topic)
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

}

