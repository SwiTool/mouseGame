var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var colors = ["#AA0000", "#00AA00", "#0000AA", "#AAAA00", "#AA00AA", "#00AAAA", "#AAAAAA", "#EEAA66", "#777FF5", "#43C85D"];
var i = 0;
var users = [];
var lines = [];

var defaultRadius = 4;
var defaultColor = "#000000";

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket) {
    console.log('User connected (' + ++i + ')');

    users[socket.id] = {
        id: socket.id,
        pseudo: "Guest" + i,
        inRoom: false
    }
    //socket.emit("color", colors[Math.floor((Math.random() * 10))])

    socket.on('enterServer', function(obj){
        if (!users[socket.id].inRoom) {
            users[socket.id].pseudo = obj.pseudo ? obj.pseudo : users[socket.id].pseudo;
            users[socket.id].color = obj.color ? obj.color : defaultColor;
            users[socket.id].radius = defaultRadius;
            users[socket.id].inRoom = true;
            socket.emit('welcome', users[socket.id]);
            socket.broadcast.emit('userConnect', users[socket.id]);
            for (u in users) {
                user = users[u];
                socket.emit('userConnect', user);
            }
            for (l in lines) {
                line = lines[l];
                socket.emit('draw', line);
            }
        }
    })

    socket.on('disconnect', function(){
        console.log(users[socket.id].pseudo + ' disconnected');
        socket.broadcast.emit('userDc', users[socket.id].id);
        delete users[socket.id];
    });

    socket.on('draw', function(obj) {
        if (users[socket.id].inRoom) {
            lines.push(obj);
            if (lines.length > 1000) {
                lines.shift();
            }
            obj.radius = users[socket.id].radius;
            socket.broadcast.emit("draw", obj);
        }
    })
});

http.listen(1337, function(){
    console.log('listening on *:1337');
});
