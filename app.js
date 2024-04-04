const net = require('net');
const { WebSocket, createWebSocketStream } = require('ws');
const { TextDecoder } = require('util');

const zzid = (process.env.ZZID || '12312332134').replace(/-/g, "");
const port = process.env.PORT || 3000;

// Create a WebSocket server
const wss = new WebSocket.Server({ port }, () => console.log('Listening on port:', port));

wss.on('connection', (ws,req) => {
     // Check if the request path matches '/mypass'
     if (req.url !== '/mypass') {
        ws.send(JSON.stringify({ "code": 500 }));
        ws.close(); // Close the connection after sending the error message
        return; // Exit the event handler to prevent further execution
    }

    console.log("New connection established");
    ws.once('message', msg => {
        const [VERSION]=msg;
        const id=msg.slice(1, 17);
        if(!id.every((v,i)=>v==parseInt(zzid.substr(i*2,2),16))) return;
        let i = msg.slice(17, 18).readUInt8()+19;
        const targetPort = msg.slice(i, i+=2).readUInt16BE(0);
        const ATYP = msg.slice(i, i+=1).readUInt8();
        // Determine the host based on the address type
        const host= ATYP==1? msg.slice(i,i+=4).join('.')://IPV4
            (ATYP==2? new TextDecoder().decode(msg.slice(i+1, i+=1+msg.slice(i,i+1).readUInt8()))://domain
                (ATYP==3? msg.slice(i,i+=16).reduce((s,b,i,a)=>(i%2?s.concat(a.slice(i-1,i+1)):s), []).map(b=>b.readUInt16BE(0).toString(16)).join(':'):''));//ipv6

        console.log('Connection details:', host, targetPort);

        // Send a response back to the client
        ws.send(new Uint8Array([VERSION, 0]));

        // Create a WebSocket stream
        const wssStream = createWebSocketStream(ws);

        // Connect to the target host and port
        net.connect({ host, port: targetPort }, function() {
            this.write(msg.slice(i));
            wssStream.on('error', (err)=>{
                console.error('Stream Error:',err)
            }).pipe(this).on('error', (err)=>{
                console.error('TCP Socket Error:',err)
            }).pipe(wssStream);
        }).on('error', err=>{
            console.error('Connection Error:', { host, port: targetPort },err)
        });
    }).on('error', err=>{
        console.error('WebSocket Error:',err)
    });
});

