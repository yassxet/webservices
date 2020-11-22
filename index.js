const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
let bodyParser = require("body-parser");
app.use(bodyParser.raw({ type: "*/*" }));

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// https://expressjs.com/en/starter/basic-routing.html
/*app.get("/", (req, res) => {
    res.sendFile(__dirname + "/views/index.html");
});*/

app.get("/sourcecode", (req, res) => {
    res.send(
        require("fs")
            .readFileSync(__filename)
            .toString()
    );
});

let tokenGenerator = length => {
    let characters =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < length; i++) {
        token += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return token;
};

let users = new Map(); //Username & password
let tokens = new Map(); //Username & generatedToken
let token_username = new Map(); //generatedToken & username

let channelNames = [];
let channelJoinedByUser = new Map(); //Username & channelName
let bannedUsers = [];
let channelCreatedBy = new Map(); //ChannelName & Username

let messages = [];

app.post("/signup", (req, res) => {
    let parsedBody = JSON.parse(req.body);
    if (users.has(parsedBody.username)) {
        res.send(JSON.stringify({ success: false, reason: "Username exists" }));
    } else if (parsedBody.username == undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "username field missing" })
        );
    } else if (parsedBody.password == undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "password field missing" })
        );
    } else {
        res.send(JSON.stringify({ success: true }));
        users.set(parsedBody.username, parsedBody.password);
    }
});

app.post("/login", (req, res) => {
    let parsedBody = JSON.parse(req.body);
    let testPassword = parsedBody.password;
    let expectedPassword = users.get(parsedBody.username);

    //Generate random token
    if (users.has(parsedBody.username) && testPassword === expectedPassword) {
        tokens.set(parsedBody.username, tokenGenerator(10));
        token_username.set(tokens.get(parsedBody.username), parsedBody.username);

        res.send(
            JSON.stringify({ success: true, token: tokens.get(parsedBody.username) })
        );
    } else if (!users.has(parsedBody.username)) {
        if (parsedBody.username === undefined) {
            res.send(
                JSON.stringify({ success: false, reason: "username field missing" })
            );
        } else
            res.send(
                JSON.stringify({ success: false, reason: "User does not exist" })
            );
    } else if (testPassword !== expectedPassword) {
        if (parsedBody.password === undefined) {
            res.send(
                JSON.stringify({ success: false, reason: "password field missing" })
            );
        } else {
            res.send(JSON.stringify({ success: false, reason: "Invalid password" }));
        }
    }
});

app.post("/create-channel", (req, res) => {
    const usernamesArr = [...users.keys()];
    let parsedBody = JSON.parse(req.body);

    if (parsedBody.channelName === undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "channelName field missing" })
        );
    } else if (req.headers.token === undefined) {
        res.send(JSON.stringify({ success: false, reason: "token field missing" }));
    } else if (
        tokens.get(token_username.get(req.headers.token)) !== req.headers.token
    ) {
        res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    } else if (channelNames.includes(parsedBody.channelName)) {
        res.send(
            JSON.stringify({ success: false, reason: "Channel already exists" })
        );
    } else {
        res.send(JSON.stringify({ success: true }));
        channelNames.push(parsedBody.channelName);
        channelCreatedBy.set(
            parsedBody.channelName,
            token_username.get(req.headers.token)
        );
    }
});

app.post("/join-channel", (req, res) => {
    let parsedBody = JSON.parse(req.body);

    const usernamesArr = [...users.keys()];

    if (bannedUsers.includes(token_username.get(req.headers.token))) {
        res.send(JSON.stringify({ success: false, reason: "User is banned" }));
    } else if (req.headers.token === undefined) {
        res.send(JSON.stringify({ success: false, reason: "token field missing" }));
    } else if (
        tokens.get(token_username.get(req.headers.token)) !== req.headers.token
    ) {
        res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    } else if (parsedBody.channelName === undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "channelName field missing" })
        );
    } else if (!channelNames.includes(parsedBody.channelName)) {
        res.send(
            JSON.stringify({ success: false, reason: "Channel does not exist" })
        );
    } else if (
        channelJoinedByUser.get(token_username.get(req.headers.token)) ===
        parsedBody.channelName
    ) {
        res.send(
            JSON.stringify({ success: false, reason: "User has already joined" })
        );
    } else {
        channelJoinedByUser.set(
            token_username.get(req.headers.token),
            parsedBody.channelName
        );
        res.send(JSON.stringify({ success: true }));
    }
});


app.post("/leave-channel", (req, res) => {
    let parsedBody = JSON.parse(req.body);

    if (req.headers.token === undefined) {
        res.send(JSON.stringify({ success: false, reason: "token field missing" }));
    } else if (
        req.headers.token !== tokens.get(token_username.get(req.headers.token))
    ) {
        res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    } else if (parsedBody.channelName === undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "channelName field missing" })
        );
    } else if (!channelNames.includes(parsedBody.channelName)) {
        res.send(
            JSON.stringify({ success: false, reason: "Channel does not exist" })
        );
    } else if (
        channelJoinedByUser.get(token_username.get(req.headers.token)) !==
        parsedBody.channelName
    ) {
        res.send(
            JSON.stringify({
                success: false,
                reason: "User is not part of this channel"
            })
        );
    } else {
        res.send(JSON.stringify({ success: true }));
        channelJoinedByUser.delete(token_username.get(req.headers.token));
    }
});

app.get("/joined", (req, res) => {
    let queryString = req.originalUrl;
    let queryParams = new URLSearchParams(queryString);
    let usersInChannel = [];

    for (let i = 0; i < channelJoinedByUser.size; i++) {
        if (
            channelJoinedByUser.get([...channelJoinedByUser.keys()][i]) ===
            queryParams.get("/joined?channelName")
        ) {
            usersInChannel.push([...channelJoinedByUser.keys()][i]);
        }
    }
    if (req.headers.token === undefined) {
        res.send(JSON.stringify({ success: false, reason: "token field missing" }));
    } else if (
        req.headers.token !== tokens.get(token_username.get(req.headers.token))
    ) {
        res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    } else if (!channelNames.includes(queryParams.get("/joined?channelName"))) {
        res.send(
            JSON.stringify({ success: false, reason: "Channel does not exist" })
        );
    } else if (
        channelJoinedByUser.get(token_username.get(req.headers.token)) !==
        queryParams.get("/joined?channelName")
    ) {
        res.send(
            JSON.stringify({
                success: false,
                reason: "User is not part of this channel"
            })
        );
    } else res.send(JSON.stringify({ success: true, joined: usersInChannel }));
});

app.post("/delete", (req, res) => {
    let parsedBody = JSON.parse(req.body);

    if (req.headers.token === undefined) {
        res.send(JSON.stringify({ success: false, reason: "token field missing" }));
    } else if (
        req.headers.token !== tokens.get(token_username.get(req.headers.token))
    ) {
        res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    } else if (parsedBody.channelName === undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "channelName field missing" })
        );
    } else if (!channelNames.includes(parsedBody.channelName)) {
        res.send(
            JSON.stringify({ success: false, reason: "Channel does not exist" })
        );
    } else res.send(JSON.stringify({ success: true }));
    channelNames.pop();
});

app.post("/kick", (req, res) => {
    let parsedBody = JSON.parse(req.body);

    if (req.headers.token === undefined) {
        res.send(JSON.stringify({ success: false, reason: "token field missing" }));
    } else if (
        req.headers.token !== tokens.get(token_username.get(req.headers.token))
    ) {
        res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    } else if (parsedBody.channelName === undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "channelName field missing" })
        );
    } else if (parsedBody.target === undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "target field missing" })
        );
    } else if (
        channelCreatedBy.get(parsedBody.channelName) !==
        token_username.get(req.headers.token)
    ) {
        res.send(
            JSON.stringify({ success: false, reason: "Channel not owned by user" })
        );
    } else {
        channelJoinedByUser.delete(parsedBody.target);
        res.send(JSON.stringify({ success: true }));
    }
});

app.post("/ban", (req, res) => {
    let parsedBody = JSON.parse(req.body);
    if (req.headers.token === undefined) {
        res.send(JSON.stringify({ success: false, reason: "token field missing" }));
    } else if (
        req.headers.token !== tokens.get(token_username.get(req.headers.token))
    ) {
        res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    } else if (parsedBody.channelName === undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "channelName field missing" })
        );
    } else if (parsedBody.target === undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "target field missing" })
        );
    } else if (
        channelCreatedBy.get(parsedBody.channelName) !==
        token_username.get(req.headers.token)
    ) {
        res.send(
            JSON.stringify({ success: false, reason: "Channel not owned by user" })
        );
    } else {
        bannedUsers.push(parsedBody.target);
        res.send(JSON.stringify({ success: true }));
    }
});

app.post("/message", (req, res) => {
    let parsedBody = JSON.parse(req.body);

    if (req.headers.token === undefined) {
        res.send(JSON.stringify({ success: false, reason: "token field missing" }));
    } else if (
        req.headers.token !== tokens.get(token_username.get(req.headers.token))
    ) {
        res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    } else if (parsedBody.channelName === undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "channelName field missing" })
        );
    } else if (parsedBody.contents === undefined) {
        res.send(
            JSON.stringify({ success: false, reason: "contents field missing" })
        );
    } else if (
        channelJoinedByUser.get(token_username.get(req.headers.token)) !==
        parsedBody.channelName
    ) {
        res.send(
            JSON.stringify({
                success: false,
                reason: "User is not part of this channel"
            })
        );
    } else {
        messages.push({
            from: token_username.get(req.headers.token),
            contents: parsedBody.contents
        });
        res.send(JSON.stringify({ success: true }));
    }
});

app.get("/messages", (req, res) => {
    let queryString = req.originalUrl;
    let queryParams = new URLSearchParams(queryString);

    let usersInChannel = [];
    let msg = [];

    for (let i = 0; i < channelJoinedByUser.size; i++) {
        if (
            channelJoinedByUser.get([...channelJoinedByUser.keys()][i]) ===
            queryParams.get("/messages?channelName")
        ) {
            usersInChannel.push([...channelJoinedByUser.keys()][i]);
        }
    }

    for (let j = 0; j < messages.length; j++) {
        if (usersInChannel.includes(messages[j].from)) {
            msg.push(messages[j]);
        }
    }

    if (!channelNames.includes(queryParams.get("/messages?channelName"))) {
        if (queryString === "/messages") {
            res.send(
                JSON.stringify({ success: false, reason: "channelName field missing" })
            );
        } else
            res.send(
                JSON.stringify({ success: false, reason: "Channel does not exist" })
            );
    } else if (!usersInChannel.includes(token_username.get(req.headers.token))) {
        res.send(
            JSON.stringify({
                success: false,
                reason: "User is not part of this channel"
            })
        );
    } else res.send(JSON.stringify({ success: true, messages: msg }));
});

// listen for requests :)
const listener = app.listen(process.env.PORT || 3000, () => {
    console.log("Your app is listening on port " + listener.address().port);
});
