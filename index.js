var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var colors = ["#AA0000", "#00AA00", "#0000AA", "#AAAA00", "#AA00AA", "#00AAAA", "#AAAAAA", "#EEAA66", "#777FF5", "#43C85D"];
var i = 0;
var users = {};
var lines = [];

// poll
var votePctAccept = 50;     // 50%
var voteDuration = 15000;   // 15s
var voteInProgress = false;
var voteTimeout = 0;
var voteAccept = 0;
var voteDecline = 0;
var voters = 0;

var penSizes = [1, 4, 8, 12, 16];

var paintCountMax = 10;      // limit 5 lines
var paintCountDelay = 100   // for every 100ms

var maxSavedLines = 1000;

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
        inRoom: false,
        locked: false,
        hasVoted: false,
        paintCount: 0,
        paintTimeout: 0
    }
    //socket.emit("color", colors[Math.floor((Math.random() * 10))])

    socket.on('enter', function(obj){
        if (!users[socket.id].inRoom) {
            users[socket.id].pseudo = obj.pseudo ? obj.pseudo.substr(0, 15) : users[socket.id].pseudo;
            users[socket.id].color = obj.color ? obj.color : defaultColor;
            users[socket.id].nativeColor = users[socket.id].color;
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
        socket.broadcast.emit('userDc', users[socket.id]);
        var result = lines.filter(function(line, i) {
            if (line.userId == socket.id) {
                delete(lines[i]);
            }
        });
        delete users[socket.id];
    });

    socket.on('draw', function(obj) {
        if (users[socket.id].inRoom && ++users[socket.id].paintCount <= paintCountMax) {
            obj.radius = users[socket.id].radius;
            obj.color = users[socket.id].color;
            obj.userId = users[socket.id].id;
            lines.push(obj);
            if (lines.length > maxSavedLines) {
                lines.shift();
            }
            socket.broadcast.emit("draw", obj);
            if (users[socket.id].paintTimeout === 0) {
                users[socket.id].paintTimeout = setTimeout(function() {
                    users[socket.id].paintCount = 0;
                    users[socket.id].paintTimeout = 0;
                }, paintCountDelay);
            }
        }
    })

    socket.on('askClear', function(vote){
        if (users[socket.id].hasVoted) {
            return;
        }
        users[socket.id].hasVoted = true;
        var arr = Object.keys(users);
        var usersConnected = arr.filter(function(id) {
            return (users[id].inRoom);
        });
        if (!voteInProgress && vote === undefined) {
            voteInProgress = true;
            // initiate the vote
            voters = 1;
            voteAccept += 1;
            io.sockets.emit('voteStart', {user: users[socket.id], nbUser: usersConnected.length});
            if (usersConnected.length <= 2) {
                lines = [];
                voteResult();
            } else {
                voteTimeout = setTimeout(function() {
                    voteResult();
                }, voteDuration);
            }
        } else if (voteInProgress){
            // vote already exist
            voters += 1;
            if (vote === undefined || vote === true) {
                voteAccept += 1;
                io.sockets.emit('vote', true);
            } else {
                io.sockets.emit('vote', false);
            }
            if (voters >= usersConnected.length) {
                clearTimeout(voteTimeout);
                voteResult();
            }
        }
    });

    socket.on('pen', function(obj) {
        users[socket.id].radius = penSizes[obj.size - 1];
        switch (obj.pen) {
            case "pen":
            users[socket.id].color = users[socket.id].nativeColor;
            break;
            case "eraser":
            users[socket.id].color = "#FFFFFF";
            break;
        }
        socket.emit('penChanged', {color: users[socket.id].color, radius: users[socket.id].radius});
    });
});

http.listen(1337, function(){
    console.log('listening on *:1337');
});

function voteResult() {
    lines = [];
    var pct = (voteAccept * 100) / voters;
    if (pct >= votePctAccept) {
        io.sockets.emit('clear', true);
    } else {
        io.sockets.emit('clear', {pct: pct, pctAccept: votePctAccept});
    }
    voteInProgress = false;
    voteAccept = 0;
    voteDecline = 0;
    voters = 0;
    setTimeout(function() {
        var arr = Object.keys(users);
        arr.filter(function(id) {
            users[id].hasVoted = false;
        });
    }, 5000);
}
