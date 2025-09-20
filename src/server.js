import express from "express";
import router from './router.js'
import mongoose from "mongoose";
import dotenv from "dotenv"
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

dotenv.config()
const app = express () 
app.use(express.json())
app.use("/api", router)

mongoose.connect(process.env.MONGO_DB_URL).then(() => {
  console.log("DB connected")
}).catch((err) => {
  console.log(err)
})
// --- Swagger configuration ---
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Auth API",
      version: "1.0.0",
      description: "User Registration, Login, and Password Reset APIs",
    },
    servers: [
      {
        url: process.env.BASE_URL,
      },
    ],
  },
  apis: ["./src/*.js"], // Path to your API routes
};

const swaggerDocs = swaggerJSDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));



app.listen(process.env.PORT, () => {
    console.log(`server started at http://localhost:${process.env.PORT}/`)
})





