import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import amqplib from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME = process.env.QUEUE_NAME;

// API to send a message to RabbitMQ
app.post("/send", async (req: Request, res: Response): Promise<any> => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        if (!RABBITMQ_URL) {
            return res.status(400).json({ error: "RABBITMQ_URL is not defined" });
        }
    
        if (!QUEUE_NAME) {
            return res.status(400).json({ error:"QUEUE_NAME is not defined" });
        }

        const connection = await amqplib.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { durable: true });
        channel.sendToQueue(QUEUE_NAME, Buffer.from(message));

        setTimeout(() => {
            connection.close();
        }, 500);

        res.json({ success: true, message: "Message sent successfully!" });
    } catch (e: any) {
        console.error("Error sending message:", e);
        res.status(500).json({ error: "Failed to send message" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});