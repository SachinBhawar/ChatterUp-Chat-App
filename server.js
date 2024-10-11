import express from "express";
import { userModel } from "./user.schema.js";
import { Server } from "socket.io";
import http from "http";
import connectToMongoDB from "./config.js";
import cors from "cors";
import bodyParser from "body-parser";
import { chatModel } from "./chat.schema.js";
import formatDateToIST from "./timestampFormatter.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let usersInRooms = {};

io.on("connection", (socket) => {
  console.log("connection established.");

  let userDp;
  // 1 listening to 'new user joined' event
  socket.on("new user joined", async (data) => {
    // joining the room by data.room which came in the emmited event
    socket.join(data.room);

    if (!data.profileImage) {
      userDp =
        "https://thumbs.dreamstime.com/b/default-avatar-profile-icon-vector-social-media-user-image-182145777.jpg";
    } else {
      userDp = data.profileImage;
    }
    // creating new user and saving it to mongodb database
    const newUser = new userModel({ userName: data.userName, profileImage: data.profileImage });
    const newUserSaved = await newUser.save();

    // storing username userId dp room in socket object
    socket.userId = newUserSaved._id;

    // Update users in room
    if (!usersInRooms[data.room]) {
      usersInRooms[data.room] = [];
    }
    usersInRooms[data.room].push({
      id: newUserSaved._id,
      name: newUserSaved.userName,
      dp: userDp,
    });

    // emitting event to the room that new user has joined
    socket.to(data.room).emit("new user joined", { userName: data.userName, room: data.room, dp: userDp });

    // emit refresh userList event
    io.to(data.room).emit("refresh room-userlist", usersInRooms[data.room]);

    //set myName myRoom myId event
    socket.emit("setMyInfo", {
      id: newUserSaved._id,
      name: newUserSaved.userName,
      dp: userDp,
      room: data.room,
    });
  });

  // 2 listening to refresh userlist and emit the event 'refresh userlist of Room' as new user is added to the room
  socket.on("refresh-userList", (room) => {
    console.log("refresh userlist called..");
    if (!usersInRooms[room]) usersInRooms[room] = [];
    const userList = usersInRooms[room];
    socket.to(room).emit("refresh room-userlist", userList);
  });

  // 3 listeming to sendMsg event and emit incomingMsg event
  socket.on("sendMsg", async (data) => {
    const userList = usersInRooms[data.room];
    let user = userList.find((ele) => ele.id == socket.userId);

    // save message to db
    const newChat = new chatModel({
      userId: socket.userId,
      username: user.name,
      message: data.message,
      room: data.room,
      createdAt: Date.now(),
    });
    await newChat.save();

    let time = formatDateToIST(newChat.createdAt);
    //emiting event for all room members excluding sender
    socket.to(data.room).emit("incomingMsg", {
      senderId: user.id,
      senderName: user.name,
      senderDP: user.dp
        ? user.dp
        : "https://thumbs.dreamstime.com/b/default-avatar-profile-icon-vector-social-media-user-image-182145777.jpg",
      message: data.message,
      time: formatDateToIST(newChat.createdAt),
    });

    //emiting event for sender
    socket.emit("outgoingMsg", { message: data.message, time });
  });

  // 4 listening to load prevMsgs
  socket.on("load prevMsgs", async (data) => {
    const timeSpan = data.timeSpan;
    let queryTime;

    switch (timeSpan) {
      case "24hrs":
        queryTime = Date.now() - 24 * 60 * 60 * 1000;
        break;
      case "oneWeek":
        queryTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
        break;
      case "oneMonth":
        queryTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        throw new Error(`Unsupported time span: ${timeSpan}`);
    }

    try {
      const messages = await chatModel.find({ room: data.room, createdAt: { $gte: queryTime } }).sort({ createdAt: 1 });
      if (messages.length == 0) {
        socket.emit("alertMsg", "No previuos messeges.");
      }
      messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      socket.emit("clearAllMsgs");

      messages.forEach(async (msg) => {
        if (msg.userId.toString() === socket.userId.toString()) {
          socket.emit("outgoingMsg", { message: msg.message, time: formatDateToIST(msg.createdAt) });
        } else {
          let userlist = usersInRooms[data.room];
          let user = userlist.find((u) => u.id == msg.userId);
          if (!user) {
            user = await userModel.findById(msg.userId);
          }

          socket.emit("incomingMsg", {
            senderId: msg.userId,
            senderName: msg.username,
            senderDP: user.profileImage
              ? user.profileImage.toString()
              : "https://thumbs.dreamstime.com/b/default-avatar-profile-icon-vector-social-media-user-image-182145777.jpg",
            message: msg.message,
            time: formatDateToIST(msg.createdAt),
          });
        }
      });
    } catch (err) {
      console.error(err);
    }

    // console.log(timeSpan, data.room);
  });

  // 5 listening to typing
  socket.on("typing", (data) => {
    io.to(data.room).emit("typing", data.id);
  });

  // 6 listening to not typing
  socket.on("notTyping", (data) => {
    io.to(data.room).emit("notTyping", data.id);
  });

  // 7 listening to user left event
  socket.on("user left", (data) => {
    console.log("user left emitted");

    // let index = usersInRooms[data.room].findIndex((user) => user.id == data.id);
    // console.log("Index", index);
    let newUserlist = usersInRooms[data.room].filter((u) => u.id.toString() !== data.id.toString());
    usersInRooms[data.room] = newUserlist;
    console.log(newUserlist.length);
    socket.to(data.room).emit("refresh room-userlist", newUserlist);
    socket.to(data.room).emit("user left", data.name);
    socket.emit("logout");
  });

  // 8 disconnection event
  socket.on("disconnect", (socket) => {
    console.log("disconnected");
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "index.html"));
});
const port = process.env.PORT;
httpServer.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
  connectToMongoDB();
});
