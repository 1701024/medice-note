const path = require('path');
const Koa = require('koa');
const server = require('koa-static');
const render = require('koa-ejs');
const bodyParser = require('koa-bodyparser');
const session = require('koa-session');
const { v4: uuid } = require('uuid');

const app = new Koa();
render(app, {
    root: path.join(__dirname, 'view'),
    layout: 'base',
    viewExt: 'html',
    cache: false,
    debug: true
});
app.use(server('./public'));
app.use(bodyParser());
app.keys = [''];
app.use(session({
    maxAge: 1000 * 60 * 60 * 24,
    secure: false
}, app));

// uuid().split('-').join('')

const indexRouter = require('./router/index');
app.use(indexRouter.routes());
app.use(indexRouter.allowedMethods());

const signupRouter = require('./router/signup');
app.use(signupRouter.routes());
app.use(signupRouter.allowedMethods());

const loginRouter = require('./router/login');
app.use(loginRouter.routes());
app.use(loginRouter.allowedMethods());

app.listen(5000);