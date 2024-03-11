import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

import { Server } from 'socket.io'
import { createServer } from 'node:http'
import e from 'express'

dotenv.config()
const port = process.env.PORT ?? 3000

const app = express()
const server = createServer(app)
const io = new Server(server, {
    connectionStateRecovery: {}
})

const db = createClient({
    url: 'libsql://loved-silvermane-sebaslade.turso.io',
    authToken: process.env.DB_TOKEN
})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        user TEXT
    )
`)

io.on('connection', async (socket) => {
    console.log('Un usuario se ha conectado!')

    socket.on('disconnect', () => {
        console.log('Un usuario se ha desconectado')
    })

    socket.on('chat message', async (msg) => {
        let result
        const username = socket.handshake.auth.username ?? 'anonymous'
        //console.log({ username })
        try {
            result = await db.execute({
                sql: 'INSERT INTO messages (content, user) VALUES (:msg, :username)',
                args: { msg, username }
            })
        } catch (error) {
            console.error('Error al enviar el mensaje: ', error)
            return
        }
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
    })

    //console.log('auth ⬇')
    //console.log(socket.handshake.auth)

    if (!socket.recovered) { // recuperar los mensajes sin conexión
        try {
            const results = await db.execute({
                sql: 'SELECT id, content, user FROM messages WHERE id > ?',
                args: [socket.handshake.auth.serverOffset ?? 0]
            })

            results.rows.forEach(row => {
                socket.emit('chat message', row.content, row.id.toString(), row.user)
            })
        } catch (error) {
            console.error(e)
        }
    }
})

app.use(logger('dev'))

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html') // cwd = CURRENT WORKING DIRECTORY
})

server.listen(port, () => {
    console.log(`Server runing on port http://localhost:${port}`)
})