const cron = require('node-cron');
const connection = require('./db');
const config = require('../config.json');
const line = require('@line/bot-sdk');
const client = new line.Client(config.line_bot);

module.exports = cron.schedule('0,30 * * * *', async () => {
    let dateObject = new Date();
    let date = formatDate(dateObject, 'yyyy-MM-dd');
    let time = formatDate(dateObject, 'HH:mm:00');
    let dayOfWeek = dateObject.getDay();

    let getNoticeListSQL =
        'SELECT SQ3.notice_id ' +
        'FROM (SELECT notice_id FROM notice_time WHERE notice_time = ?)SQ ' +
        'RIGHT JOIN (SELECT notice_id FROM notice_day WHERE day_of_week = ?)SQ2 ON SQ.notice_id = SQ2.notice_id ' +
        'LEFT JOIN (SELECT notice_id, notice_period FROM notice WHERE is_enable = true)SQ3 ON SQ.notice_id = SQ3.notice_id ' +
        'WHERE SQ3.notice_period >= ?;';
    // let noticeList = (await connection.query(getNoticeListSQL, ['00:00:00',dayOfWeek,date]))[0];
    let noticeList = (await connection.query(getNoticeListSQL, [time, dayOfWeek, date]))[0];

    await pushNotice(noticeList);
});

// format 'Date' object's output
function formatDate(date, format) {
    format = format.replace(/yyyy/g, date.getFullYear());
    format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
    format = format.replace(/dd/g, ('0' + date.getDate()).slice(-2));
    format = format.replace(/HH/g, ('0' + date.getHours()).slice(-2));
    format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
    format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
    format = format.replace(/SSS/g, ('00' + date.getMilliseconds()).slice(-3));
    return format;
}

// push notice message to line_user in noticeList
async function pushNotice(noticeList) {
    for (let noticeRow of noticeList) {
        let to = await getLineUserId(noticeRow['notice_id']);
        let message = await createPushMessage(noticeRow['notice_id']);
        await client.pushMessage(to, message, false)
            .then(async () => {
                let message = '機能: pushNotice  ステータスコード: 200';
                await insertUserMessage(noticeRow['notice_id'], message, 2);
            })
            .catch(async (error) => {
                let errorMsg = '機能: pushNotice  ステータスコード: ' + error['statusCode'] + '  エラーメッセージ: ' + error['statusMessage'];
                await insertUserMessage(noticeRow['notice_id'], errorMsg, 3);
            })
    }
}

// get line_user_id to push message
async function getLineUserId(noticeId) {
    let getLineUserIdSQL =
        'SELECT line_user_id ' +
        'FROM (SELECT user_id FROM notice N WHERE notice_id = ?)SQ ' +
        'LEFT JOIN line_notice_user_id LN ON SQ.user_id = LN.user_id;';
    return (await connection.query(getLineUserIdSQL, [noticeId]))[0][0]['line_user_id'];
}

// create the text to push message
async function createPushMessage(noticeId) {
    let getNoticeDataSQL =
        'SELECT SQ.notice_name, M.medicine_name, M.number ' +
        'FROM (' +
        'SELECT notice_id, notice_name FROM notice WHERE notice_id = ?' +
        ')SQ LEFT JOIN notice_medicine NM ON SQ.notice_id = NM.notice_id ' +
        'LEFT JOIN medicine M on NM.medicine_id = M.medicine_id;';
    let noticeData = (await connection.query(getNoticeDataSQL, [noticeId]))[0];

    let messageText = '[' + noticeData[0]['notice_name'] + ']\n';
    for (let row of noticeData) {
        messageText += '・' + row['medicine_name'];
        messageText += ': ';
        messageText += row['number'];
        messageText += '個\n';
    }

    return {
        type: 'text',
        text: messageText
    };
}

async function insertUserMessage(noticeId, resultMessage, resultFlg) {
    let getUserIdSQL = 'SELECT user_id FROM notice WHERE notice_id = ?;';
    let userId = (await connection.query(getUserIdSQL, [noticeId]))[0][0]['user_id'];

    let insertErrorSQL = 'INSERT INTO user_message VALUES (0,?,?,?);';
    await connection.query(insertErrorSQL, [userId, resultMessage, resultFlg]);
}