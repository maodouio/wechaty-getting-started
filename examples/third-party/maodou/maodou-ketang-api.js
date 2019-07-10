const { parseTime, parseTitleAndLocation } = require('./maodou-nlp')

const debug = require("debug")("maodou-ketang-api.js")
const fetch = require('node-fetch')

function createCourse(originalText, createCallback) {
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
            createMaodouCourse(title, start_time, location, notes, createCallback)            
        })
    }
}

function createCourseWithLive(originalText, liveId, createCallback) {
    // get rid of html tags like <img class="qqemoji qqemoji0"> in case someone use emoji input
    var msgText = originalText.replace(/<[^>]*>?/gm, '')
    debug("[-emoji]", {msgText})

    // get rid of blank space in the left
    msgText = msgText.replace(/(^\s*)/g, '')
    debug("[-space]", {msgText})

    // add blank space before 号楼
    var msgText2 = msgText.replace(/号楼/g, '#号楼')
    console.log('[debug 号楼parser] ==> Time: ', msgText2)

    // replace d-d点 to d点-d点
    var msgText2 = msgText2.replace(/(\d+)\-(\d+)点/g, '$1点-$2点')
    console.log('[debug d-d点parser] ==> Time: ', msgText2)

    const time = parseTime(msgText2)
    console.log('[parser] ==> Time: ', {time})

    // now we have 'time', next we use bosonnlp to parse for 'title' and 'location'
    if (time) {
        parseTitleAndLocation(msgText, function(title, location) {
            console.log('[parser] ==> Title: ', {title})
            console.log('[parser] ==> Location: ', {location})

            // title, start_time, location, notes is 4 params to create a new maodou course
            const start_time = time
            const liveUrl = 'https://smh.maodou.io/course/' + liveId
            const notes = originalText + '\n直播间' + liveUrl
            createMaodouCourse(title, start_time, location, notes, createCallback)            
        })
    }
}

/**
 * query Maodou api to create a new course
 * @param title: required
 * @param start_time, location, notes: options
 */
async function createMaodouCourse(title, start_time, location, notes, createMaodouCourseCallback) {
    debug('createCourse params:', {title}, {start_time}, {location}, {notes})

    let path = '/courses'
    let postBody = {
        "title": title,
        "start_time": start_time,
        "location": location,
        "duration": 3600,
        "count": 1,
        "freq": "NONE",
        "alerts": [
            // {
            //   at: -3600, //单位s
            //   by: 'sms',
            // },
            {
              at: -1800,
              by: 'wxmsg',
            },
            {
              at: -900,
              by: 'call',
            },
        ],
        "notes": notes
    }

    // call maodou api
    await fetchMaodouAPI(path, postBody, createMaodouCourseCallback)
    return
}

/**
 * Fetch response from Maodou API
 * @param URL
 * @param postBody
 * @param fetchCallback: covert json to msg text when fetch succeeds
 */
async function fetchMaodouAPI(path, postBody, fetchCallback) {
    let resText = null
    const url = 'https://api.maodouketang.com/api/v1' + path
    const options = {
                method: "POST",
                body: JSON.stringify(postBody), // put keywords and token in the body
                // If you want to get alert by your own phone, replace with your own 'authorization'
                // To get your own 'authorization', please see it in README.md
                headers: {
                  'Content-Type': 'application/json',
                  'authorization': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1ZDFmMDM3YmRmZjM3ZTAwMTE0ODJmN2EiLCJvcGVuSWQiOiJvRHprWTBXdXluNWtiNFZLeFNBdlctbFVsLTBNIiwiaWF0IjoxNTYyMzEzNTk1LCJleHAiOjE1Njc0OTc1OTV9.heN04WOd1o3n6CxiyMjHNNN-ErlJaXsmPWcwlouofWQ"
                }
            }
    debug('fetchMaodouAPI: ', {url}, {options})

    try {
        let resp = await fetch( url, options )
        let resp_json = await resp.json()

        debug('[resp_json]', resp_json)
        if (resp_json['errcode'] == 200) {
            // status code = 200, we got it!
            debug('[resp_json.data]', resp_json['data'])
            resText = fetchCallback(resp_json['data'])
        } else {
            // status code = 4XX/5XX, sth wrong with API
            debug('[resp_json.errmsg]', resp_json['errmsg'])
            resText = 'API ERROR: ' + resp_json['errmsg']
        }
    } catch (err) {
        debug('[err]', err)
        resText = 'NETWORK ERROR: ' + err
    }
    return resText
}

// module.exports = createCourse
module.exports = createCourseWithLive
