import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

export const connectDB = async () => {
    try {
        if (!MONGO_URI) {
            throw new Error("MONGO_URI is not defined");
        }

        await mongoose.connect(MONGO_URI);
        console.log("MongoDB connected...");
    } catch(e) {
        console.error("MongoDB connection error:", e);
        process.exit(1);
    }
}