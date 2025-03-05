import amqplib from 'amqplib';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { Message } from './models/Messages';

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME = process.env.QUEUE_NAME ?? 'task_queue';
const DLQ_QUEUE = process.env.DLQ_QUEUE ?? 'task_dlq';

const processMessage = async () => {
    await connectDB();

    const connection = await amqplib.connect(RABBITMQ_URL!);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    console.log("Worker is consuming messages...");

    channel.consume(QUEUE_NAME, async (msg) => {
        if (!msg) return;

        const data = JSON.parse(msg.content.toString());
        console.log("Processing:", data.content);

        if (Math.random() < 0.7) {
            console.log("Processed successfully:", data.content);
            await Message.findByIdAndUpdate(data.id, { status: "processed" });
            channel.ack(msg);
        } else {
            console.log("Processing failed, sending to DLQ:", data.content);
            await Message.findByIdAndUpdate(data.id, { status: "failed" });
            const dlqChannel = await connection.createChannel();
            await dlqChannel.assertQueue(DLQ_QUEUE, { durable: true });
            dlqChannel.sendToQueue(DLQ_QUEUE, msg.content);
            channel.ack(msg);
        }
    });
}

processMessage();