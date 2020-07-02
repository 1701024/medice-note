const Router = require('koa-router');
const router = new Router();
const app = require('../app/app');
const connection = require('../app/db');
const lineLogin = require("line-login");
const lineConfig = require('../config.sample.json');
const login = new lineLogin({
    channel_id: lineConfig.line.LINE_LOGIN_CHANNEL_ID,
    channel_secret: lineConfig.line.LINE_LOGIN_CHANNEL_SECRET,
    callback_url: lineConfig.line.LINE_LOGIN_CALLBACK_URL,
});

router.get('/account-setting', async (ctx, next) => {
    let session = ctx.session;
    app.initializeSession(session);

    let authId = session.auth_id;
    let userId = await app.getUserId(authId);
    if (!authId || !userId) {
        return ctx.redirect('/');
    }

    let result = app.initializeRenderResult();
    result['data']['meta']['login_status'] = true;
    result['data']['meta']['site_title'] = 'アカウント設定 - Medice Note';

    let sql = 'SELECT user_name, mail FROM user WHERE user_id = ?';
    let [user] = await connection.query(sql, [userId]);
    result['data']['account'] = {};
    result['data']['account']['user_name'] = user[0]['user_name'];
    result['data']['account']['mail'] = user[0]['mail'];

    let lineLoginSQL = 'SELECT line_user_name, access_token, refresh_token FROM line_login WHERE user_id = ?;';
    let lineUserData = (await connection.query(lineLoginSQL, [userId]))[0];

    if(lineUserData.length > 0){
        //LINEログイン済みの場合、アクセストークンを検証
        let lineUserName = lineUserData[0].line_user_name;
        let lineAccessToken = lineUserData[0].access_token;
        let lineRefreshToken = lineUserData[0].refresh_token;

        let verifyAccessTokenResult = await login.verify_access_token(lineAccessToken);

        if(typeof verifyAccessTokenResult.error === 'undefined'){
            //アクセストークンの検証成功時、LINEログイン済みとしてレンダリング
            result['data']['account']['line_user_name'] = lineUserName;

        }else{
            //アクセストークンの検証拒否時、リフレッシュトークンで期間延長申請する
            let refreshAccessTokenResult = login.refresh_access_token(lineRefreshToken);

            if(typeof refreshAccessTokenResult.error === 'undefined'){
                //アクセストークン更新成功時はDBの'access_token'と'refresh_token'を更新
                let newAccessToken = refreshAccessTokenResult.access_token;
                let newRefreshToken = refreshAccessTokenResult.refresh_token;
                let refreshTokenSQL = 'UPDATE line_login SET access_token = ?, refresh_token = ? WHERE user_id=?;';

                await connection.query(refreshTokenSQL, [newAccessToken, newRefreshToken, userId])
                result['data']['account']['line_user_name'] = lineUserName[0]['line_user_name'];

            }else{
                //アクセストークン更新失敗時はDBのLINE関連登録情報を全て削除して再登録させる
                let deleteLineLoginSQL = 'DELETE FROM line_login WHERE user_id = ?;';
                await connection.query(deleteLineLoginSQL, [userId]);
                let deleteLineNoticeUserId = 'DELETE FROM line_notice_user_id WHERE user_id = ?;';
                await connection.query(deleteLineNoticeUserId, [userId]);
            }
        }
    }

    await ctx.render('account-setting', result);
})

module.exports = router;