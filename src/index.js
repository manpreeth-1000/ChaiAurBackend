import dotenv from 'dotenv';
dotenv.config({});

// import mongoose from 'mongoose'
// import { DB_NAME } from './constants.js'

import connectDB from './db/index.js'

connectDB()
.then(() => {
    app.on("error", (err) => {
        console.log("Something wrong with express app", err);
        throw err
    })
    app.listen(process.env.PORT || 8000, () => {
        console.log("Sever is running at ",process.env.PORT)
    })
})
.catch((err) => {
    console.log("MongoDB Connectio failed", err)
})



















/*
import express from "express"
const app = express()

(async () =>{
    try {
        await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
        app.on("error",(error)=>{
            console.log("Error: ",error)
            throw error
        })
        app.listen(process.env.PORT, ()=>{
            console.log(`App is listening on port ${process.env.PORT}`)
        })
    } catch (error) {
        console.error("Error: ",error)
        throw err
    } 
})()
*/
