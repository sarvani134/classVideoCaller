import mongoose from "mongoose";
const Schema=mongoose.Schema

const userSchema=new Schema({
    // Keep this legacy field populated while older MongoDB deployments retain userId_1.
    userId: { type: String, select: false },
    auth0Id: {
      type: String,
      required: true,
      unique: true,
    },
    name: String,
  email: String,
  picture: String,
    
},{timestamps:true})

export const User=mongoose.model("User",userSchema)
