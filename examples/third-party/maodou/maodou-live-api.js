const { parseTime, parseTitleAndLocation } = require('./maodou-nlp')

const debug = require("debug")("maodou-live-api.js")
const fetch = require('node-fetch')
const ax = require("axios")


function createLive(originalText, createCallback) {
    // get rid of html tags like <img class="qqemoji qqemoji0"> in case someone use emoji input
    var msgText = originalText.replace(/<[^>]*>?/gm, '')
    debug("[-emoji]", {msgText})

    // get rid of blank space in the left
    msgText = msgText.replace(/(^\s*)/g, '')
    debug("[-space]", {msgText})

    const time = parseTime(msgText)
    console.log('[parser] ==> Time: ', {time})

    // now we have 'time', next we use bosonnlp to parse for 'title' and 'location'
    if (time) {
        parseTitleAndLocation(msgText, function(title, location) {
            console.log('[parser] ==> Title: ', {title})
            console.log('[parser] ==> Location: ', {location})

            // title, start_time, location, notes is 4 params to create a new maodou course
            const start_time = time
            const notes = originalText
            createMaodouLive(title, start_time, location, notes, createCallback)            
        })
    }
}

/**
 * query Maodou api to create a new course
 * @param title: required
 * @param start_time, location, notes: options
 */
async function createMaodouLive(title, start_time, location, notes, createMaodouCourseCallback) {
    debug('createLive params:', {title}, {start_time}, {location}, {notes})

    let path = '/new_course'
    let postBody = {
        userId: 'owner', // 必填 需要数据库中加入username
        name: title,  // 必填
        author: '毛豆小助手',
        startTime: start_time,
        // token: '1234567890', //连麦toekn，固定
        intro: notes
    }

    // call maodou api
    await fetchMaodouLiveAPI(path, postBody, createMaodouCourseCallback)
    return
}

/**
 * Fetch response from Maodou API
 * @param URL
 * @param postBody
 * @param fetchCallback: covert json to msg text when fetch succeeds
 */
async function fetchMaodouLiveAPI(path, postBody, fetchCallback) {
    let resText = null
    const url = 'https://smh.maodou.io/api' + path

    ax.get(url,
    {
        params: postBody
    }).then(function(res){
        // let resp_json = res.json()
        if(res.data.errcode == 200) {
            // status code = 200, we got it!
            console.log('[res.data]', res.data)
            resText = fetchCallback(res.data.data)
        } else {
            // status code = 4XX/5XX, sth wrong with API
            console.log('[res.errmsg]', res.data)
            resText = 'API ERROR: ' + res.data.errmsg
        }
    }).catch(function(err){
        debug('[err]', err)
        resText = 'NETWORK ERROR: ' + err
    })

    return resText
}

module.exports = createLive
