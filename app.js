const net = require('net');
const { WebSocket, createWebSocketStream } = require('ws');
const { TextDecoder } = require('util');

const zzid = (process.env.ZZID || '12312332134').replace(/-/g, "");
const port = process.env.PORT || 3000;

// Create a WebSocket server
const wss = new WebSocket.Server({ port }, () => console.log('Listening on port:', port));

wss.on('connection', ws => {
    console.log("New connection established");
    ws.once('message', msg => {
        const [VERSION] = msg;
        const id = msg.slice(1, 17);

        if (!id.every((v, i) => v == parseInt(zzid.substr(i * 2, 2), 16))) return;

        let offset = 17;
        const headerLength = msg.slice(offset, ++offset).readUInt8();
        offset += headerLength; // Adjust offset for the actual header length

        // Extract target port and address type
        const targetPort = msg.slice(offset, offset += 2).readUInt16BE();
        const ATYP = msg.slice(offset, ++offset).readUInt8();

        // Determine the host based on the address type
        const host = ATYP === 1 ? msg.slice(offset, offset += 4).join('.') :
                     ATYP === 3 ? new TextDecoder().decode(msg.slice(offset + 1, offset += 1 + msg.slice(offset, offset + 1).readUInt8())) :
                     ATYP === 4 ? msg.slice(offset, offset += 16).reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), []).map(b => b.readUInt16BE().toString(16)).join(':') : '';

        console.log('Connection details:', host, targetPort);

        // Send a response back to the client
        ws.send(new Uint8Array([VERSION, 0]));

        // Create a WebSocket stream
        const wssStream = createWebSocketStream(ws);

        // Connect to the target host and port
        net.connect({ host, port: targetPort }, function() {
            this.write(msg.slice(offset));
            wssStream.on('error', console.error('Stream Error:')).pipe(this).on('error', console.error('TCP Socket Error:')).pipe(wssStream);
        }).on('error', console.error('Connection Error:', { host, port: targetPort }));
    }).on('error', console.error('WebSocket Error:'));
});

