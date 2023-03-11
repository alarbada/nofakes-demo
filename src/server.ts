import http from 'http'
import config from '../config.json'

const server = http.createServer((req, res) => {

    const url = new URL(req.url!, `http://${req.headers.host}`);



    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('Hello World')
})

server.listen(config.port, () => {
    console.log('Server running at http://localhost:3000')
})

