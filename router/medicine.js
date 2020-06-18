const Router = require('koa-router');
const router = new Router();
const app = require('../app/app');
const connection = require('../app/db');

router.get('/medicine/:medicine_id', async (ctx) => {
    let session = ctx.session;

    let authId = session.auth_id;
    let userId = await app.getUserId(authId);
    if (!userId) {
        session.error = 'ログインしていないため続行できませんでした';

        return ctx.redirect('/login');
    }

    let medicineId = ctx.params['medicine_id'];
    if (!await app.isHaveMedicine(medicineId, userId)) {
        session.error = '薬情報が見つかりませんでした';

        return ctx.redirect('/medicine-list');
    }

    let result = app.initializeRenderResult();
    result['data']['meta']['login_status'] = true;
    result['data']['meta']['site_title'] = '薬情報一覧 - Medice Note';
    result['data']['meta']['script'] = [
        '/stisla/modules/sweetalert/sweetalert.min.js',
        '/js/medicine-delete-alert.js'
    ];

    let sql = 'SELECT medicine_id, medicine_name, hospital_name, number, ' +
        'date_format(starts_date, \'%Y年%c月%d日\') as starts_date, period, ' +
        'medicine_type.type_name, image, description, group_id FROM medicine ' +
        'LEFT JOIN medicine_type ON medicine.type_id = medicine_type.type_id ' +
        'WHERE medicine_id = ?';
    let [data] = await connection.query(sql, [medicineId]);
    result['data']['medicine'] = data[0];

    sql = 'SELECT take_time_name FROM medicine_take_time ' +
        'LEFT JOIN take_time ON medicine_take_time.take_time_id = take_time.take_time_id ' +
        'WHERE medicine_id = ?';
    [data] = await connection.query(sql, [medicineId]);
    result['data']['medicine']['take_time'] = data;

    session.success = {};
    session.error = {};

    if (session.success.message !== undefined) {
        result['data']['success']['message'] = session.success.message;
        session.success.message = undefined;
    }

    if (session.error.message !== undefined) {
        result['data']['error']['message'] = session.error.message;
        session.error.message = undefined;
    }

    await ctx.render('medicine', result);
})

module.exports = router;
