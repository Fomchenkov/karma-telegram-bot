#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose()
const Telegraf = require('telegraf')

const dbName = 'db.db'
const BotToken = process.argv[2]
const BotUsername = process.argv[3]
const bot = new Telegraf(BotToken)

// Deploy database
const db = new sqlite3.Database(dbName);
db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS userskarma (\
        id INTEGER NOT NULL PRIMARY KEY,\
        uid INTEGER NOT NULL UNIQUE,\
        uname TEXT NUT NULL,\
        karma INTEGER NOT NULL)');
    db.close()
})

/**
 * Check that text is thanks.
 * @param {string} text - user text with thanks.
 * @return {boolean} - thanks or not.
 */
function isThanks(text) {
    if (text == '+') return true
}

/**
 * Add new user to Data Base.
 * @param {int} uid - telegram user id.
 */
function addUserToDataBase(uid, uname) {
    return new Promise((res, rej) => {
        const db = new sqlite3.Database(dbName);
        db.serialize(() => {
            let sql = 'INSERT OR IGNORE INTO userskarma (uid, uname, karma) VALUES (?, ?, ?)'
            let stmt = db.prepare(sql);
            stmt.run(uid, uname, 0)
            stmt.finalize();
            res()
        })
        db.close()
    })
}

/**
 * Add +1 to users karma.
 * @param {int} uid - telegram user id.
 * @return {int} - current user karma.
 */
function incrementUserKarma(uid) {
    return new Promise((res, rej) => {
        const db = new sqlite3.Database(dbName);
        db.serialize(() => {
            let sql = 'UPDATE userskarma SET karma=karma+1 WHERE uid=$uid'
            db.run(sql, { $uid: uid })
            db.serialize(() => {
                sql = `SELECT * FROM userskarma WHERE uid=${uid}`
                db.all(sql, (err, rows) => {
                    if (err) console.log(err)
                    rows.forEach((row) => {  
                        if (row.karma)
                            res(row.karma)
                    })
                    res(0)
                })
            })
        })
        db.close()
    })
}

/**
 * Get users with hightly karma.
 * @param {int} limit - count of data base to selection.
 * @return {array} - array with top users.
 */
function getTopKarmaUsers(limit=10) {
    return new Promise((res, rej) => {
        const db = new sqlite3.Database(dbName);
        db.serialize(() => {
            let sql = `SELECT * FROM userskarma ORDER BY karma DESC LIMIT ${limit}`
            db.all(sql, (err, rows) => {
                res(rows)
            })
        })
        db.close()
    })
}

bot.command(['top', `top@${BotUsername}`], ctx => {
    getTopKarmaUsers().then(arr => {
        let message = 'Пользователи с самой высокой кармой:\n'
        arr.forEach((element, index) => {
            message += `${index+1}. ${element['uname']} - *${element['karma']}*.\n`
        })
        ctx.reply(message, {
            parse_mode: 'markdown'
        })
    })
})

bot.command(['help', `help@${BotUsername}`], ctx => {
    let message = 'Бот поднимает пользователям карму.'
    message += ' Для того, что бы поднять карму другому пользователю,'
    message += ' нужно ответить (reply) ему на сообщение знаком "+". После этого бот'
    message += ' увеличит пользователю карму на 1 и отправит уведомление об этом в чат.'
    message += ' Что бы увидеть список пользователей с самой высокой кармой - отправьте команду /top.'
    message += '\n\nБот разработан студией Kronver:\n@Kronver_bot'
    ctx.reply(message)
})

bot.on('text', (ctx) => {
    let text = ctx.message.text
    // If reply message exists and chat type is group.
    if (ctx.message.reply_to_message && ctx.message.chat.type == 'group') {
        // Answer author.
        let karmaAuthorId = ctx.message.reply_to_message.from.id
        let karmaAuthorName = ctx.message.reply_to_message.from.first_name
        addUserToDataBase(karmaAuthorId, karmaAuthorName)
        // If it is one user.
        if (ctx.message.from.id == ctx.message.reply_to_message.from.id) {
            return
        }

        if (isThanks(text)) {
            // Increment karma
            incrementUserKarma(karmaAuthorId).then(currrentKarma => {
                let message = `Пользователь ${karmaAuthorName} получает *+1* к карме. `
                message += `Текущая карма пользователя ${karmaAuthorName} - *${currrentKarma}*.`
                message += `\nПодробнее - /help.`
                ctx.reply(message, {
                    parse_mode: 'markdown'
                })
            }).catch(e => console.log(e))
        }
    }
})

bot.on('new_chat_member', ctx => {
    addUserToDataBase(ctx.message.from.id, ctx.message.from.first_name)
    let uname = ctx.message.from.first_name
    let message = `Добро пожаловать, *${uname}*!`
    ctx.reply(message, {
        parse_mode: 'markdown'
    })
})

bot.on('left_chat_member', ctx => {
    let uid = ctx.message.left_chat_member.first_name
    let message = `Ты был мне братом, *${uid}*! Я любил тебя!`
    ctx.reply(message, {
        parse_mode: 'markdown'
    })
})

bot.startPolling()
