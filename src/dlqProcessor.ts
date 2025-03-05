import amqplib from 'amqplib';
import { connectDB } from './config/db';
import { Message } from './models/Messages';
import dotenv from 'dotenv';

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const DLQ_QUEUE = process.env.DLQ_QUEUE ?? 'task_dlq';
const QUEUE_NAME = process.env.QUEUE_NAME ?? 'task_queue';

const processDeadLetterMessages = async () => {
    try {
        if (!RABBITMQ_URL) {
            throw new Error("RABBITMQ_URL is not defined");
        }

        await connectDB();
        const connection = await amqplib.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue(DLQ_QUEUE, { 
            durable: true,            
        });

        console.log("DLQ Processor is monitoring messages...");

        channel.consume(DLQ_QUEUE, async(msg) => {
            if (!msg) return;

            const data = JSON.parse(msg.content.toString());
            
            console.log(`Reprocessing DLQ message: ${data.content}`);
            await Message.findByIdAndUpdate(data.id, { status: "reprocessed" });

            const mainChannel = await connection.createChannel();
            await mainChannel.assertQueue(QUEUE_NAME, { durable: true });
            mainChannel.sendToQueue(QUEUE_NAME, msg.content);

            channel.ack(msg);
        });
    } catch(e) {
        console.error("Error in DLQ Processor:", e);
    }
}

processDeadLetterMessages();