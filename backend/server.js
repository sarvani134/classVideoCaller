import "dotenv/config"
import express from "express"
import { Server } from "socket.io"
import {createServer} from "http"
import mongoose from "mongoose"
import cors from "cors"
const app=express()
app.use(cors())
app.use(express.json({ limit: "8mb" }))
app.use(express.urlencoded({extended:true}))
import { socketConnection } from "./controllers/socketManager.js"
const server=createServer(app)
const io = socketConnection(server)


import dns from "node:dns";

import { router } from "./routes/userRoute.js"
import { Meeting } from "./models/meetingModel.js"
import { User } from "./models/userModel.js"

dns.setServers(["8.8.8.8", "1.1.1.1"]); 
                                             


app.get("/",(req,res)=>{
    res.json({msg:"hello"})
})

app.use("/users",router)
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const status = error.status || error.statusCode || 500
    res.status(status).json({ msg: status === 401 ? "Your access token was rejected. Log out and log in again." : status === 403 ? "Your account is not authorized to access this API." : 
        "The server could not process the request." })
})
const start=async()=>{
    const connectDB=await mongoose.connect(process.env.CONNECTION_STRING)
    console.log("connected to DB")
    try {
        const userIndexes = await User.collection.indexes()
        const obsoleteUserIdIndex = userIndexes.find((index) =>
            index.unique === true && Object.keys(index.key || {}).length === 1 && index.key.userId !== undefined,
        )
        if (obsoleteUserIdIndex) {
            await User.collection.dropIndex(obsoleteUserIdIndex.name)
            console.log(`Removed obsolete unique index ${obsoleteUserIdIndex.name} from users`)
        }
    } catch (error) {
        if (error.code === 26 || error.codeName === "NamespaceNotFound") {
            // The users collection is created on first profile save.
        } else if (error.code === 13 || error.codeName === "Unauthorized") {
            console.warn("Could not remove the obsolete userId index; new profiles will populate userId until the index can be removed")
        } else {
            throw error
        }
    }
    const attendanceMigration = await Meeting.updateMany(
        { attendanceVersion: { $ne: 3 } },
        { $set: { attendees: [], attendanceVersion: 3 } },
    )
    if (attendanceMigration.modifiedCount) {
        console.log(`Cleared legacy attendance from ${attendanceMigration.modifiedCount} meeting records`)
    }
    
server.listen(process.env.PORT,()=>{
    console.log(`listening from PORT ${process.env.PORT}`)
})
}
start().catch(error => {
    console.error("Backend startup failed:", error.name, error.code || "")
    process.exitCode = 1
})

