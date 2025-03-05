import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import amqplib from 'amqplib';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { Message } from './models/Messages';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME = process.env.QUEUE_NAME ?? 'task_queue';

// Connect to MongoDB
connectDB();

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

        const connection = await amqplib.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { 
            durable: true,
        });

        // Save to MongoDB
        const newMessage = new Message({ content: message, status: 'pending' });
        await newMessage.save();

        channel.sendToQueue(QUEUE_NAME, Buffer.from(
            JSON.stringify({
                id: newMessage._id,
                content: message
            })
        ));
        console.log("Message sent:", message);

        res.json({ success: true, message: "Message sent successfully!" });
    } catch (e: any) {
        console.error("Error sending message:", e);
        res.status(500).json({ error: "Failed to send message" });
    }
});

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'OK' });
});

// API to manually retry messages from DLQ
app.post('/retry-dlq', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!RABBITMQ_URL) {
            return res.status(400).json({ error: "RABBITMQ_URL is not defined" });
        }

        const failedMessages = await Message.find({ status: "failed" });

        const connection = await amqplib.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { durable: true });

        failedMessages.forEach((msg) => {
            channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(msg)));
            console.log("Retried message:", msg.content);
        });

        await Message.updateMany({ status: "failed" }, { status: "pending" });
        res.json({ success: true, message: "Retried all DLQ messages" });
    } catch(e) {
        console.error("Error retrying messages:", e);
        res.status(500).json({ error: "Failed to retry messages" });
    }
});

app.get('/dlq-messages', async (req: Request, res: Response) => {
    try {
        const messages = await Message.find({ status: "failed" });
        res.json({ success: true, data: messages });
    } catch (e) {
        console.error("Error fetching DLQ messages:", e);
        res.status(500).json({ error: "Failed to fetch DLQ messages" });
    }
});

app.post('/retry-dlq/:id', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!RABBITMQ_URL) {
            return res.status(400).json({ error: "RABBITMQ_URL is not defined" });
        }

        const { id } = req.params;
        // Fetch message from MongoDB
        const message = await Message.findById(id);

        if(!message) {
            return res.status(404).json({ error: "Message not found in DLQ" });
        }

        const connection = await amqplib.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { durable: true });


        // Move message back to main queue
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)));
        console.log("Retried specific message:", message.content);

        // Update status in MongoDB
        await Message.findByIdAndUpdate(id, { status: "pending" });
        res.json({ success: true, message: `Message ${id} retried successfully` });
    } catch(e) {
        console.error("Error retrying message:", e);
        res.status(500).json({ error: "Failed to retry message" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});